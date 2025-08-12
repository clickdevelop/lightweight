import { Service } from '../decorators';
import { env } from '../config/env';
import { sequelize } from '../config/sequelize';
import { Model, ModelStatic, Op } from 'sequelize'; // Import Op
import bcrypt from 'bcryptjs';

@Service()
export class AuthService {
  private authModel: ModelStatic<any> | null = null;

  constructor() {
    try {
      this.authModel = sequelize.model(env.AUTH_MODEL_NAME);
      console.log(`[AuthService] Using configured authentication model: '${env.AUTH_MODEL_NAME}'`);
    } catch (error) {
      console.warn(`[AuthService] Model '${env.AUTH_MODEL_NAME}' not found during construction. It must be available when auth routes are called.`);
      this.authModel = null;
    }
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('[AuthService] Error during bcrypt.compare:', error);
      return false;
    }
  }

  async validateUser(loginIdentifier: string, pass: string): Promise<any | null> {
    if (!this.authModel) {
      try {
        this.authModel = sequelize.model(env.AUTH_MODEL_NAME);
      } catch (error) {
        console.error(`[AuthService] Authentication model '${env.AUTH_MODEL_NAME}' not found.`);
        throw new Error(`Authentication model '${env.AUTH_MODEL_NAME}' not found.`);
      }
    }

    const user = await this.authModel.findOne({
      where: {
        [Op.or]: [
          { [env.AUTH_USERNAME_FIELD]: loginIdentifier },
          { [env.AUTH_EMAIL_FIELD]: loginIdentifier }
        ]
      }
    });

    if (user && await this.comparePassword(pass, user.get(env.AUTH_PASSWORD_FIELD) as string)) {
      return user;
    }

    return null;
  }
}
