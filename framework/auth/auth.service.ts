import { Service } from '../decorators';
import { env } from '../config/env';
import { sequelize } from '../config/sequelize';
import { Model, ModelStatic } from 'sequelize';
import bcrypt from 'bcryptjs';

@Service()
export class AuthService {
  private readonly DEFAULT_ADMIN_USERNAME = 'admin';
  private readonly DEFAULT_ADMIN_PASSWORD_LENGTH = 12;
  private authModel: ModelStatic<any> | null = null; // Pode ser null se o modelo não for encontrado
  private internalAdminHashedPassword: string | null = null; // Para o admin padrão em memória
  private internalAdminUsername: string | null = null; // Para o admin padrão em memória

  constructor() {
    try {
      // Tenta obter o modelo configurado pelo usuário
      this.authModel = sequelize.model(env.AUTH_MODEL_NAME);
      console.log(`[AuthService] Using configured authentication model: '${env.AUTH_MODEL_NAME}'`);
    } catch (error) {
      console.warn(`[AuthService] Model '${env.AUTH_MODEL_NAME}' not found in Sequelize. Falling back to internal admin user.`);
      this.authModel = null; // Definir como null se o modelo não for encontrado
    }
  }

  // Este método será chamado explicitamente do application.ts
  public async bootstrapAdminUser(): Promise<void> {
    if (this.authModel) {
      // Se um modelo configurado foi encontrado, usa-o para bootstrapping
      try {
        const userCount = await this.authModel.count();
        console.log(`[AuthService] Current user count for model '${env.AUTH_MODEL_NAME}': ${userCount}`);

        if (userCount === 0) {
          const generatedPassword = this.generateRandomPassword(this.DEFAULT_ADMIN_PASSWORD_LENGTH);
          const hashedPassword = await this.hashPassword(generatedPassword);

          await this.authModel.create({
            [env.AUTH_USERNAME_FIELD]: this.DEFAULT_ADMIN_USERNAME,
            [env.AUTH_PASSWORD_FIELD]: hashedPassword,
            // Adicione outros campos padrão se necessário (e.g., role: 'admin')
          });

          console.log('\n--------------------------------------------------');
          console.log('  ADMIN USER CREATED (FOR DEVELOPMENT ONLY)');
          console.log('  Username: ', this.DEFAULT_ADMIN_USERNAME);
          console.log('  Password: ', generatedPassword);
          console.log('--------------------------------------------------\n');
        }
      } catch (error) {
        console.error('Error bootstrapping admin user with configured model:', error);
        console.error('This might happen if the authentication model or its fields are not correctly defined or synchronized.');
        // Se falhar com o modelo configurado, ainda podemos tentar o fallback
        await this.bootstrapInternalAdmin();
      }
    } else {
      // Se nenhum modelo configurado foi encontrado, usa o admin interno
      await this.bootstrapInternalAdmin();
    }
  }

  private async bootstrapInternalAdmin(): Promise<void> {
    if (this.internalAdminHashedPassword) {
      console.log('[AuthService] Internal admin user already bootstrapped.');
      return;
    }

    const generatedPassword = this.generateRandomPassword(this.DEFAULT_ADMIN_PASSWORD_LENGTH);
    const hashedPassword = await this.hashPassword(generatedPassword);

    this.internalAdminUsername = this.DEFAULT_ADMIN_USERNAME;
    this.internalAdminHashedPassword = hashedPassword;

    console.log('\n--------------------------------------------------');
    console.log('  INTERNAL ADMIN USER CREATED (FALLBACK)');
    console.log('  Username: ', this.internalAdminUsername);
    console.log('  Password: ', generatedPassword);
    console.log('  Hashed Password (stored): ', this.internalAdminHashedPassword); // Adicionado log
    console.log('--------------------------------------------------\n');
  }

  private generateRandomPassword(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    console.log(`[AuthService] Comparing: Plain='${password}', Hashed='${hashedPassword}'`);
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('[AuthService] Error during bcrypt.compare:', error);
      return false; // Retorna falso em caso de erro na comparação
    }
  }

  async validateUser(username: string, pass: string): Promise<any | null> {
    console.log(`[AuthService] Validating user: Username='${username}', Password='${pass}'`);
    if (this.authModel) {
      // Se um modelo configurado foi encontrado, usa-o para validação
      const user = await this.authModel.findOne({
        where: {
          [env.AUTH_USERNAME_FIELD]: username
        }
      });

      if (user && await this.comparePassword(pass, user.get(env.AUTH_PASSWORD_FIELD) as string)) {
        return user;
      }
      return null;
    } else {
      // Se nenhum modelo configurado foi encontrado, valida contra o admin interno
      console.log(`[AuthService] Internal Admin Username (in validateUser): ${this.internalAdminUsername}`);
      console.log(`[AuthService] Internal Admin Hashed Password (in validateUser): ${this.internalAdminHashedPassword}`);
      if (username === this.internalAdminUsername && this.internalAdminHashedPassword) {
        console.log('[AuthService] Attempting internal admin password comparison.'); // Novo log
        const isValid = await this.comparePassword(pass, this.internalAdminHashedPassword);
        if (isValid) {
          return { id: 'internal-admin', username: this.internalAdminUsername };
        }
      }
      return null;
    }
  }
}
