#!/usr/bin/env node

const { Command } = require('commander');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk').default;
const crypto = require('crypto'); // Adicionado

// ASCII Art Banner
const banner = `
${chalk.bold.rgb(255, 165, 0)("  _     _       _ _         _             _ _ _ _ ")}
${chalk.bold.rgb(255, 165, 0)(" | |   (_)     | (_)       | |           (_) | (_) |")}
${chalk.bold.rgb(255, 165, 0)(" | |    _ _ __ | |_ ___ ___| |__  _ __   ___| |_| |_| |")}
${chalk.bold.rgb(255, 165, 0)(" | |   | | '_ \\| | / __/ __| '_ \\| '_ \\ / __| __| __| |")}
${chalk.bold.rgb(255, 165, 0)(" | |___| | | | | | \\__ \\__ \\ |_) | |_) | (__| |_| |_| |")}
${chalk.bold.rgb(255, 165, 0)(" |______|_|_| |_|_|_|___/___/_.__/| .__/ \\___|\\__|\\__|_|")}
${chalk.bold.rgb(255, 165, 0)("                                  | |                  ")}
${chalk.bold.rgb(255, 165, 0)("                                  |_|                  ")}

${chalk.bold.cyan("                                  Version: 3.4.0")}
${chalk.bold.blue("                                  Company: Click 3.4 Developer")}
`;

console.log(banner);

const program = new Command();

program
  .version('3.0.0') // Major version for restored, stable architecture
  .description('LightSpringTS CLI for scaffolding components');

// --- RESTORED AND CORRECTED TEMPLATES ---

const generateFullControllerTemplate = (name) => {
  const lowerCaseName = name.toLowerCase();
  return `import { Controller, Get, Post, Put, Delete, Body, Param } from '../../framework/decorators';
import { ${name}Service } from '../services/${lowerCaseName}.service';
import { Create${name}Dto, Update${name}Dto } from '../dtos/${lowerCaseName}.dto';

@Controller('/${lowerCaseName}s')
export class ${name}Controller {
  constructor(private readonly ${lowerCaseName}Service: ${name}Service) {}

  @Get('/', {
    schema: {
      summary: 'Get all tasks',
      tags: ['${name}s'],
      response: {
        200: { type: 'array', items: { $ref: '#/definitions/${name}' } }
      }
    }
  })
  findAll() {
    return this.${lowerCaseName}Service.findAll();
  }

  @Get('/:id', {
    schema: {
      summary: 'Get task by ID',
      tags: ['${name}s'],
      params: {
        id: { type: 'string', format: 'uuid' }
      },
      response: {
        200: { $ref: '#/definitions/${name}' }
      }
    }
  })
  findById(@Param('id') id: string) {
    return this.${lowerCaseName}Service.findById(id);
  }

  @Post('/', {
    schema: {
      summary: 'Create task',
      tags: ['${name}s'],
      body: { $ref: '#/definitions/Create${name}Dto' },
      response: {
        201: { $ref: '#/definitions/${name}' }
      }
    }
  })
  create(@Body() createDto: Create${name}Dto) {
    return this.${lowerCaseName}Service.create(createDto);
  }

  @Put('/:id', {
    schema: {
      summary: 'Update task',
      tags: ['${name}s'],
      params: {
        id: { type: 'string', format: 'uuid' }
      },
      body: { $ref: '#/definitions/Update${name}Dto' },
      response: {
        200: { $ref: '#/definitions/${name}' }
      }
    }
  })
  update(@Param('id') id: string, @Body() updateDto: Update${name}Dto) {
    return this.${lowerCaseName}Service.update(id, updateDto);
  }

  @Delete('/:id', {
    schema: {
      summary: 'Delete task',
      tags: ['${name}s'],
      params: {
        id: { type: 'string', format: 'uuid' }
      },
      response: {
        204: { type: 'null' }
      }
    }
  })
  delete(@Param('id') id: string) {
    return this.${lowerCaseName}Service.delete(id);
  }
}
`;
};

const generateControllerTemplate = (name) => {
  const lowerCaseName = name.toLowerCase();
  return `import { Controller, Get, Post, Put, Delete, Body, Param } from '../../framework/decorators';

@Controller('/${lowerCaseName}s')
export class ${name}Controller {

  @Get('/')
  async getAll() {
    // Logic to retrieve all ${lowerCaseName}s
    return 'List of all ${lowerCaseName}s';
  }
}
`;
};

const generateServiceTemplate = (name) => {
    const lowerCaseName = name.toLowerCase();
    return `import { Service } from '../../framework/decorators';
import { ${name} } from '../models/${lowerCaseName}.model';
import { Create${name}Dto, Update${name}Dto } from '../dtos/${lowerCaseName}.dto';

@Service()
export class ${name}Service {
  findAll() { return ${name}.findAll(); }
  findById(id: string) { return ${name}.findByPk(id); }
  create(createDto: Create${name}Dto) { return ${name}.create(createDto as any); }
  update(id: string, updateDto: Update${name}Dto) { return ${name}.update(updateDto, { where: { id }, returning: true }); }
  delete(id: string) { return ${name}.destroy({ where: { id } }); }
}
`;
};

const generateDtoTemplate = (name) => `import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class Create${name}Dto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class Update${name}Dto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
`;

const generateModelTemplate = (name) => `import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../framework/config/sequelize';
import { IsString, IsBoolean, IsUUID, IsOptional } from 'class-validator';

export class ${name} extends Model {
  @IsUUID(4)
  public id!: string;

  @IsString()
  public title!: string;

  @IsString()
  @IsOptional()
  public description?: string;

  @IsBoolean()
  public completed!: boolean;
}

${name}.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
  completed: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, modelName: '${name}', tableName: '${name.toLowerCase()}s' });
`;

// --- HELPER FUNCTIONS ---
async function createFile(filePath, content) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content);
  console.log(`Created: ${path.relative(process.cwd(), filePath)}`);
}

// --- CLI COMMANDS ---

program
  .command('new <projectName>')
  .description('Create a new LightSpringTS project with a chosen architecture and optional authentication.')
  .action(async (projectName) => {
    const projectPath = path.join(process.cwd(), projectName);
    const templatePath = path.resolve(__dirname, '..');

    console.log(`Creating project '${projectName}'...`);
    fs.copySync(templatePath, projectPath, { filter: (src) => !/lightspringts-cli|node_modules|dist|\\.git/.test(src) });

    const answers = await inquirer.default.prompt([
        { type: 'list', name: 'architecture', message: 'Which architecture would you like to use?', choices: [ { name: 'Model-View-Controller (MVC)', value: 'mvc' }, { name: 'Hexagonal Architecture', value: 'hexagonal' }, { name: 'None (basic structure only)', value: 'none' } ], default: 'mvc' },
        { type: 'confirm', name: 'enableAuth', message: 'Enable JWT authentication?', default: true },
    ]);

    let envContent = `ARCHITECTURE=${answers.architecture}
AUTH_ENABLED=${answers.enableAuth}
PORT=2000
DB_DIALECT=postgres
`;
    if (answers.enableAuth) {
        const jwtSecretChoice = await inquirer.default.prompt([
            {
                type: 'confirm',
                name: 'autoGenerateJwtSecret',
                message: 'Do you want to auto-generate a JWT Secret?',
                default: true,
            },
        ]);

        let jwtSecret;
        if (jwtSecretChoice.autoGenerateJwtSecret) {
            jwtSecret = crypto.randomBytes(32).toString('hex');
            console.log(chalk.green(`Auto-generated JWT Secret: ${jwtSecret}`)); // Show the generated secret
        } else {
            const customJwtSecretAnswer = await inquirer.default.prompt([
                {
                    type: 'input',
                    name: 'customJwtSecret',
                    message: 'Please enter your custom JWT Secret:',
                    validate: (input) => input.length > 0 || 'JWT Secret cannot be empty.',
                },
            ]);
            jwtSecret = customJwtSecretAnswer.customJwtSecret;
        }
        envContent += `JWT_SECRET=${jwtSecret}\n`;
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

    if (answers.architecture !== 'none') {
        console.log('Scaffolding default CRUD for \'Task\'...');
        await createFile(path.join(projectPath, 'src/controllers/task.controller.ts'), generateFullControllerTemplate('Task'));
        await createFile(path.join(projectPath, 'src/services/task.service.ts'), generateServiceTemplate('Task'));
        await createFile(path.join(projectPath, 'src/dtos/task.dto.ts'), generateDtoTemplate('Task'));
        await createFile(path.join(projectPath, 'src/models/task.model.ts'), generateModelTemplate('Task'));
    }

    console.log('Installing dependencies...');
    execSync('npm install', { cwd: projectPath, stdio: 'inherit' });

    console.log(`\nSuccess! Project created at ${projectPath}`);
    console.log('To start, run:\n');
    console.log(`  cd ${projectName}`);
    console.log('  npm run dev\n');
  });

const generateCommand = program.command('generate')
  .description('Generate various components for your LightSpringTS project.');

generateCommand.command('controller <name>')
  .description('Generate a new controller.')
  .action(async (name) => {
    const filePath = path.join(process.cwd(), `src/controllers/${name.toLowerCase()}.controller.ts`);
    await createFile(filePath, generateControllerTemplate(name));
    console.log(chalk.green(`Controller ${name} generated successfully!`));
  });

generateCommand.command('service <name>')
  .description('Generate a new service.')
  .action(async (name) => {
    const filePath = path.join(process.cwd(), `src/services/${name.toLowerCase()}.service.ts`);
    await createFile(filePath, generateServiceTemplate(name));
    console.log(chalk.green(`Service ${name} generated successfully!`));
  });

generateCommand.command('dto <name>')
  .description('Generate a new Data Transfer Object (DTO).')
  .action(async (name) => {
    const filePath = path.join(process.cwd(), `src/dtos/${name.toLowerCase()}.dto.ts`);
    await createFile(filePath, generateDtoTemplate(name));
    console.log(chalk.green(`DTO ${name} generated successfully!`));
  });

generateCommand.command('model <name>')
  .description('Generate a new database model.')
  .action(async (name) => {
    const filePath = path.join(process.cwd(), `src/models/${name.toLowerCase()}.model.ts`);
    await createFile(filePath, generateModelTemplate(name));
    console.log(chalk.green(`Model ${name} generated successfully!`));
  });

generateCommand.command('migration <name>')
  .description('Generate a new migration.')
  .action(async (name) => {
    console.log(chalk.yellow(`Generating migration: ${name}...`));
    try {
      execSync(`npx sequelize-cli migration:generate --name ${name}`, { stdio: 'inherit', cwd: process.cwd() });
      console.log(chalk.green(`Migration ${name} generated successfully!`));
    } catch (error) {
      console.error(chalk.red(`Failed to generate migration: ${error.message}`));
    }
  });

program
  .command('db:migrate')
  .description('Run database migrations.')
  .action(async () => {
    console.log(chalk.yellow('Running database migrations...'));
    try {
      execSync('npx ts-node node_modules/.bin/sequelize-cli db:migrate', { stdio: 'inherit', cwd: process.cwd() });
      console.log(chalk.green('Database migrations ran successfully!'));
    } catch (error) {
      console.error(chalk.red(`Failed to run migrations: ${error.message}`));
    }
  });

program.parse(process.argv);
