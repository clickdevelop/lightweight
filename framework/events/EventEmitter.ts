import { EventEmitter } from 'events';
import { Service } from '../decorators';

@Service()
export class AppEventEmitter extends EventEmitter {}
