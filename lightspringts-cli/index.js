#!/usr/bin/env node

const { Command } = require('commander');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk');
const crypto = require('crypto');

// ASCII Art Banner
const banner = `
  _     _       _ _         _             _ _ _ _ 
 | |   (_)     | (_)       | |           (_) | (_) |
 | |    _ _ __ | |_ ___ ___| |__  _ __   ___| |_| |_| |
 | |   | | '_ \\| | / __/ __| '_ \\| '_ \\ / __| __| __| |
 | |___| | | | | | \\__ \\__ \\ |_) | |_) | (__| |_| |_| | |)
 |______|_|_| |_|_|_|___/___/_.__/| .__/ \\___|\\__\\__|_|
                                  | |
                                  |_|

                                  Version: 1.0.0
                                  Company: Click 3.4 Developer
`;

console.log(banner);

const program = new Command();

program
  .version('1.0.0')
  .description('LightSpringTS CLI for scaffolding components');

// --- TEMPLATES ---

// --- Task Templates ---
const generateTaskControllerTemplate = (name = 'Task') => `import { Controller, Get, Post, Put, Delete, Body, Param, Roles } from '../../framework/decorators';


@Controller('/tasks')
export class TaskController {
   @Get('/')
  getAllTasks() {
    // Logic to retrieve all tasks
    return 'List of all tasks';
  }
}`;

const generateTaskServiceTemplate = (name = 'Task') => `import { Service } from '../../framework/decorators';
import { Task } from '../models/task.model';
import { CreateTaskDto, UpdateTaskDto } from '../dtos/task.dto';

@Service()
export class TaskService {
  findAll() { return Task.findAll(); }
  findById(id: string) { return Task.findByPk(id); }
  create(createDto: CreateTaskDto) { return Task.create(createDto as any); }
  update(id: string, updateDto: UpdateTaskDto) { return Task.update(updateDto, { where: { id }, returning: true }); }
  delete(id: string) { return Task.destroy({ where: { id } }); }
}`;

const generateTaskDtoTemplate = (name = 'Task') => `import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}`;

const generateTaskModelTemplate = (name = 'Task') => `import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../framework/config/sequelize';

export class Task extends Model {
  public id!: string;
  public title!: string;
  public description?: string;
  public completed!: boolean;
}

Task.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
  completed: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, modelName: 'Task', tableName: 'tasks' });`;




// --- Generic Templates ---
const generateControllerTemplate = (name) => `import { Controller, Get, Post, Put, Delete, Body, Param, Roles } from '../../framework/decorators';


@Controller('/${name.toLowerCase()}s')
export class ${name}Controller {


   @Get('/')
    public async getAll() {
        return { message: 'Get all ${name}' };
    }
}
`;

const generateServiceTemplate = (name) => `import { Service } from '../../framework/decorators';

@Service()
export class ${name}Service {
  
}
`;

const generateDtoTemplate = (name) => `import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class Create${name}Dto {
 
}

export class Update${name}Dto {
 
}
`;

const generateModelTemplate = (name) => `import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../framework/config/sequelize';

export class ${name} extends Model {
  
}

${name}.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
}, { sequelize, modelName: '${name}', tableName: '${name.toLowerCase()}s' });
`;

// --- User Templates (for Auth) ---

const generateUserControllerTemplate = () => `import { Controller, Get, Post, Put, Delete, Body, Param, Roles } from '../../framework/decorators';
import { UserService } from '../services/user.service';
import { CreateUserDto, UpdateUserDto } from '../dtos/user.dto';

@Controller('/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/', {
    summary: 'Create a new user',
    description: 'If no users exist in the database, this route is public. The first user created will be an admin. Afterwards, this route requires admin privileges.',
    tags: ['Users'],
    body: CreateUserDto
  })
  create(@Body() createDto: CreateUserDto) {
    return this.userService.create(createDto);
  }

  @Get('/', { summary: 'Get all users', tags: ['Users'] })
  @Roles('admin')
  findAll() {
    return this.userService.findAll();
  }
  
  @Get('/:id', { summary: 'Get user by ID', tags: ['Users'], schema: { params: { id: { type: 'string', format: 'uuid' } } } })
  @Roles('admin')
  findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Put('/:id', { summary: 'Update a user', tags: ['Users'], schema: { params: { id: { type: 'string', format: 'uuid' } } }, body: UpdateUserDto })
  @Roles('admin')
  update(@Param('id') id: string, @Body() updateDto: UpdateUserDto) { return this.userService.update(id, updateDto); }

  @Delete('/:id', { summary: 'Delete a user', tags: ['Users'], schema: { params: { id: { type: 'string', format: 'uuid' } } } })
  @Roles('admin')
  delete(@Param('id') id: string) { return this.userService.delete(id); }
}`;

const generateUserServiceTemplate = () => `import { Service, Inject } from '../../framework/decorators';
import { User } from '../models/user.model';
import { CreateUserDto, UpdateUserDto } from '../dtos/user.dto';
import { AuthService } from '../../framework/auth/auth.service';
import { container } from '../../framework/di/container';

@Service()
export class UserService {
  private authService: AuthService;

  constructor() {
    // Manually resolve AuthService since it's a framework service
    this.authService = container.resolve('AuthService');
  }

  async create(createDto: CreateUserDto) {
    const userCount = await User.count();
    
    const roles = userCount === 0 ? ['admin'] : (createDto.roles || ['user']);

    const hashedPassword = await this.authService.hashPassword(createDto.password);
    
    const user = await User.create({
      ...createDto,
      password: hashedPassword,
      roles: roles
    } as any);

    // Don't return the password hash
    const { password, ...result } = user.toJSON();
    return result;
  }

  async findAll() {
    return User.findAll({ attributes: { exclude: ['password'] } });
  }

  async findById(id: string) {
    return User.findByPk(id, { attributes: { exclude: ['password'] } });
  }

  async update(id: string, updateDto: UpdateUserDto) {
    if (updateDto.password) {
      updateDto.password = await this.authService.hashPassword(updateDto.password);
    }
    const [affectedCount, updatedUsers] = await User.update(updateDto, { where: { id }, returning: true });
    if (affectedCount > 0) {
      const { password, ...result } = updatedUsers[0].toJSON();
      return result;
    }
    return null;
  }

  async delete(id: string) {
    return User.destroy({ where: { id } });
  }
}`;

const generateUserDtoTemplate = () => `import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches, IsArray, ArrayMinSize } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/, {
    message: 'Password is too weak. It must be at least 8 characters long and contain one uppercase letter, one lowercase letter, one number, and one special character.'
  })
  password!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/, {
    message: 'Password is too weak. It must be at least 8 characters long and contain one uppercase letter, one lowercase letter, one number, and one special character.'
  })
  password?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];
}`;

const generateUserModelTemplate = () => `import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../framework/config/sequelize';

export class User extends Model {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public roles!: string[];
}

User.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  roles: { type: DataTypes.JSON, defaultValue: ['user'] },
}, { sequelize, modelName: 'User', tableName: 'users' });`;

const generateUserMigrationContent = () => `'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      roles: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: ['user'],
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  },
}`;


// --- Auth Templates ---
const generateAuthDtoTemplate = () => `import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string; // Can be username or email

  @IsString()
  @IsNotEmpty()
  password!: string;
}`;

const generateAuthControllerTemplate = () => `import { Controller, Post, Body, Ctx } from '../../framework/decorators';
import { LoginDto } from '../dtos/auth.dto';
import { AuthService } from '../../framework/auth/auth.service';
import { container } from '../../framework/di/container';
import jwt from 'jsonwebtoken';
import { env } from '../../framework/config/env';
import { FastifyReply } from 'fastify';
import { redisClient } from '../../framework/cache/redis';
import { User } from '../models/user.model'; // Import User model

@Controller('/auth')
export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = container.resolve('AuthService');
  }

  @Post('/login', {
    summary: 'User login',
    tags: ['Auth'],
    schema: {
      body: { $ref: '#/definitions/LoginDto' },
      response: {
        200: { type: 'object', properties: { token: { type: 'string' } } },
        401: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  })
  async login(@Body() loginDto: LoginDto, @Ctx() reply: FastifyReply) {
    const user = await this.authService.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      reply.code(401).send({ message: 'Invalid credentials' });
      return;
    }

    const payload = { id: user.id, username: user.username, roles: user.roles };
    const token = jwt.sign(payload, env.JWT_SECRET!, { expiresIn: '1h' });

    reply.setCookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'strict',
    });

    return { token };
  }

  @Post('/logout', {
    summary: 'User logout',
    tags: ['Auth'],
    schema: {
      response: { 200: { type: 'object', properties: { message: { type: 'string' } } } },
    },
  })
  async logout(@Ctx() reply: FastifyReply) {
    const token = reply.request.cookies.token;

    if (token && redisClient) {
      try {
        const decoded = jwt.decode(token) as { exp: number };
        if (decoded && decoded.exp) {
            const expiry = decoded.exp - Math.floor(Date.now() / 1000);
            if (expiry > 0) {
                await redisClient.setex('blocklist:' + token, expiry, 'blocked');
            }
        }
      } catch (error) {
        console.error('Error adding token to blocklist:', error);
      }
    }

    reply.clearCookie('token', { path: '/' });
    return { message: 'Logout successful' };
  }
}`;

// --- HELPER FUNCTIONS ---
async function createFile(filePath, content) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content);
  console.log(chalk.default.green("  -> Created: " + path.relative(process.cwd(), filePath)));
}

// --- CLI COMMANDS ---

program
  .command('new <projectName>')
  .description('Create a new LightSpringTS project.')
  .action(async (projectName) => {
    const projectPath = path.join(process.cwd(), projectName);
    const templatePath = path.resolve(__dirname, '..');

    console.log(chalk.default.blue(`Creating project '${projectName}'...`));
    fs.copySync(templatePath, projectPath, { filter: (src) => !/lightspringts-cli|node_modules|dist|\.git/.test(src) });

    // Define o nome do framework para substituição
    const frameworkName = 'lightspring-ts';
    const frameworkDisplayName = 'LightSpringTS'; // Para o README e outros textos

    // 1. Atualizar package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageJson.name = projectName.toLowerCase(); // Nome do projeto em minúsculas
      packageJson.description = `A backend application built with ${projectName}.`; // Descrição genérica
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(chalk.default.green(`  -> Updated: ${path.relative(process.cwd(), packageJsonPath)}`));
    }

    // 2. Atualizar README.md
    const readmePath = path.join(projectPath, 'README.md');
    if (fs.existsSync(readmePath)) {
      let readmeContent = fs.readFileSync(readmePath, 'utf8');
      // Substitui o nome do framework e o nome de exibição
      readmeContent = readmeContent.replace(new RegExp(frameworkName, 'g'), projectName.toLowerCase());
      readmeContent = readmeContent.replace(new RegExp(frameworkDisplayName, 'g'), projectName); // Mantém a capitalização para exibição
      fs.writeFileSync(readmePath, readmeContent);
      console.log(chalk.default.green(`  -> Updated: ${path.relative(process.cwd(), readmePath)}`));
    }

    const answers = await inquirer.default.prompt([
        { type: 'list', name: 'architecture', message: 'Which architecture would you like to use?', choices: [ { name: 'Model-View-Controller (MVC)', value: 'mvc' }, { name: 'None (basic structure only)', value: 'none' } ], default: 'mvc' },
        { type: 'confirm', name: 'enableAuth', message: 'Enable JWT authentication?', default: true },
    ]);

    let envContent = `ARCHITECTURE=${answers.architecture}\nAUTH_ENABLED=${answers.enableAuth}\nPORT=2000\n`;
    if (answers.enableAuth) {
        const jwtSecret = crypto.randomBytes(32).toString('hex');
        console.log(chalk.default.yellow(`Auto-generated JWT Secret.`));
        envContent += `JWT_SECRET=${jwtSecret}\n`;
        envContent += `AUTH_MODEL_NAME=User\n`;        envContent += `AUTH_USERNAME_FIELD=username\n`;        envContent += `AUTH_EMAIL_FIELD=email\n`;        envContent += `AUTH_PASSWORD_FIELD=password\n`;
    }
    if (answers.architecture !== 'none') {
        const dbAnswers = await inquirer.default.prompt([
            { type: 'list', name: 'DB_DIALECT', message: 'Database Dialect:', choices: ['postgres', 'mysql', 'mariadb', 'sqlite', 'mssql'], default: 'postgres' },
            { type: 'input', name: 'DB_HOST', message: 'Database Host:', default: 'localhost' },
            { type: 'input', name: 'DB_PORT', message: 'Database Port:', default: '5432' },
            { type: 'input', name: 'DB_NAME', message: 'Database Name:', default: `${projectName}_db` },
            { type: 'input', name: 'DB_USER', message: 'Database User:', default: 'postgres' },
            { type: 'password', name: 'DB_PASSWORD', message: 'Database Password:', mask: '*' },
        ]);
        for (const key in dbAnswers) { envContent += `${key}=${dbAnswers[key]}\n`; }
    }
    await createFile(path.join(projectPath, '.env'), envContent);
    
    let appTsContent = fs.readFileSync(path.join(projectPath, 'src/application.ts'), 'utf8');
   
    fs.writeFileSync(path.join(projectPath, 'src/application.ts'), appTsContent);
    console.log(chalk.default.yellow('Updated: src/application.ts'));

    const cliPublicPath = path.resolve(__dirname, '..', 'public');
    const projectPublicPath = path.join(projectPath, 'public');
    await fs.ensureDir(projectPublicPath);
    if (answers.enableAuth) {
        await fs.copy(path.join(cliPublicPath, 'index.html'), path.join(projectPublicPath, 'index.html'));
        await fs.copy(path.join(cliPublicPath, 'login.html'), path.join(projectPublicPath, 'login.html'));
    } else {
        await fs.copy(path.join(cliPublicPath, 'no-auth-welcome.html'), path.join(projectPublicPath, 'index.html'));
        fs.removeSync(path.join(projectPublicPath, 'login.html'));
    }

    if (answers.architecture !== 'none' && !answers.enableAuth) {
        console.log(chalk.default.blue("Scaffolding default CRUD for 'Task'..."));
        await createFile(path.join(projectPath, 'src/controllers/task.controller.ts'), generateTaskControllerTemplate());
        await createFile(path.join(projectPath, 'src/services/task.service.ts'), generateTaskServiceTemplate());
        await createFile(path.join(projectPath, 'src/dtos/task.dto.ts'), generateTaskDtoTemplate());
        await createFile(path.join(projectPath, 'src/models/task.model.ts'), generateTaskModelTemplate());
    }

    if (answers.enableAuth) {
      console.log(chalk.default.blue('Scaffolding JWT authentication and User CRUD...'));
      await createFile(path.join(projectPath, 'src/controllers/auth.controller.ts'), generateAuthControllerTemplate());
      await createFile(path.join(projectPath, 'src/dtos/auth.dto.ts'), generateAuthDtoTemplate());
      
      await createFile(path.join(projectPath, 'src/controllers/user.controller.ts'), generateUserControllerTemplate());
      await createFile(path.join(projectPath, 'src/services/user.service.ts'), generateUserServiceTemplate());
      await createFile(path.join(projectPath, 'src/dtos/user.dto.ts'), generateUserDtoTemplate());
      await createFile(path.join(projectPath, 'src/models/user.model.ts'), generateUserModelTemplate());

      console.log(chalk.default.blue('Generating user migration...'));
      const migrationName = `${new Date().toISOString().replace(/[-:.]/g, '')}-create-user.js`;
      const migrationPath = path.join(projectPath, 'framework/migrations', migrationName);
      await createFile(migrationPath, generateUserMigrationContent());
    }

    console.log(chalk.default.yellow('Installing dependencies...'));
    execSync('npm install', { cwd: projectPath, stdio: 'inherit' });

    console.log(chalk.default.green("\nSuccess! Project created at " + projectPath));
    console.log('To start, run:\n');
    console.log(chalk.default.cyan("  cd " + projectName));
    console.log(chalk.default.cyan('  npm run dev'));
  });

// --- BUILD COMMAND ---
program
  .command('build')
  .description('Build the project for production.')
  .option('--docker', 'Create a Docker image after the build.')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const distPath = path.join(projectRoot, 'dist');
    const srcPath = path.join(projectRoot, 'src');

    // 1. Clean the dist directory
    console.log(chalk.default.blue('Cleaning old build...'));
    try {
      fs.removeSync(distPath);
      console.log(chalk.default.green('  -> Cleaned: ./dist'));
    } catch (error) {
      console.error(chalk.default.red('Error cleaning dist directory:'), error);
      process.exit(1);
    }

    // 2. Compile TypeScript
    console.log(chalk.default.blue('\nCompiling TypeScript...'));
    try {
      execSync('npx tsc', { stdio: 'inherit' });
      console.log(chalk.default.green('  -> TypeScript compiled successfully.'));
    } catch (error) {
      console.error(chalk.default.red('\nFailed to compile TypeScript.'));
      process.exit(1);
    }

    // 3. Copy non-TS assets
    console.log(chalk.default.blue('\nCopying assets...'));
    try {
      fs.copySync(srcPath, distPath, {
        filter: (src) => {
          if (fs.lstatSync(src).isDirectory()) {
            return true; // Always copy directories
          }
          return path.extname(src) !== '.ts';
        }
      });
      console.log(chalk.default.green('  -> Assets copied successfully.'));
    } catch (error) {
      console.error(chalk.default.red('Error copying assets:'), error);
      process.exit(1);
    }

    console.log(chalk.default.bold.green('\nBuild complete!'));
    console.log(`Your production-ready application is in: ${distPath}`);

    // 4. Docker Build (if requested)
    if (options.docker) {
      console.log(chalk.default.blue('\nStarting Docker image build...'));
      try {
        const projectPackageJsonPath = path.join(projectRoot, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(projectPackageJsonPath, 'utf8'));
        const projectName = packageJson.name || 'lightspring-app';

        const dockerfileContent = `
# --- Estágio 1: Builder ---
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./

RUN npm ci --only=production

COPY dist ./dist
COPY public ./public

# --- Estágio 2: Runner ---
FROM node:18-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/public ./public

# Default port, can be overridden by ENV var
EXPOSE 3000

CMD ["node", "dist/src/application.js"]
`;
        fs.writeFileSync(path.join(projectRoot, 'Dockerfile'), dockerfileContent.trim());
        console.log(chalk.default.green('  -> Created: Dockerfile'));

        const dockerignoreContent = `
.git
node_modules
src
.env
Dockerfile
.dockerignore
`;
        fs.writeFileSync(path.join(projectRoot, '.dockerignore'), dockerignoreContent.trim());
        console.log(chalk.default.green('  -> Created: .dockerignore'));

        console.log(chalk.default.blue(`\nBuilding Docker image '${projectName}:latest'...\n`));
        execSync(`docker build -t ${projectName}:latest .`, { stdio: 'inherit' });

        console.log(chalk.default.bold.green(`\nDocker image '${projectName}:latest' built successfully!`));

      } catch (error) {
        console.error(chalk.default.red('\nFailed to build Docker image. Is Docker running?'), error.message);
        process.exit(1);
      }
    }
  });


const generateCommand = program.command('generate')
  .description('Generate various project components such as controllers, services, DTOs, models, and database migrations. Use `lg generate --help` for more details on subcommands.');

generateCommand
  .command('controller <name>')
  .description('Generate a new controller.')
  .action(async (name) => {
    const controllerPath = path.join(process.cwd(), `src/controllers/${name.toLowerCase()}.controller.ts`);
    await createFile(controllerPath, generateControllerTemplate(name));
  });

generateCommand
  .command('service <name>')
  .description('Generate a new service.')
  .action(async (name) => {
    const servicePath = path.join(process.cwd(), `src/services/${name.toLowerCase()}.service.ts`);
    await createFile(servicePath, generateServiceTemplate(name));
  });

generateCommand
  .command('dto <name>')
  .description('Generate a new DTO.')
  .action(async (name) => {
    const dtoPath = path.join(process.cwd(), `src/dtos/${name.toLowerCase()}.dto.ts`);
    await createFile(dtoPath, generateDtoTemplate(name));
  });

generateCommand
  .command('model <name>')
  .description('Generate a new model.')
  .action(async (name) => {
    const modelPath = path.join(process.cwd(), `src/models/${name.toLowerCase()}.model.ts`);
    await createFile(modelPath, generateModelTemplate(name));
  });

generateCommand
  .command('migration <name>')
  .description('Generate a new migration file.')
  .action(async (name) => {
    console.log(chalk.default.blue(`Generating migration: ${name}...`));
    try {
      execSync(`npx sequelize-cli migration:create --name ${name}`, { stdio: 'inherit' });
      console.log(chalk.default.green('Migration generated successfully.'));
    } catch (error) {
      console.error(chalk.default.red('Failed to generate migration:'), error.message);
    }
  });

const runCommand = program.command('run')
  .description('Run various project-related tasks.');

runCommand
  .command('migrations')
  .description('Run all pending database migrations.')
  .action(async () => {
    console.log(chalk.default.blue('Running migrations...'));
    try {
      execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' });
      console.log(chalk.default.green('Migrations ran successfully.'));
    } catch (error) {
      console.error(chalk.default.red('Failed to run migrations:'), error.message);
    }
  });

// ... (generate commands can be added back if needed, but are removed for this focused update)

program.parse(process.argv);