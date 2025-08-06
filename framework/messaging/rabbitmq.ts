import { connect, ChannelWrapper } from 'amqp-connection-manager';
import { Channel, ConsumeMessage } from 'amqplib';
import { env } from '../config/env';

let channelWrapper: ChannelWrapper | null = null;

export function connectRabbitMQ(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!env.RABBITMQ_URL) {
      console.log('RabbitMQ URL not provided, skipping connection.');
      return resolve();
    }

    const connection = connect([env.RABBITMQ_URL]);

    connection.on('connect', () => {
      console.log('Connected to RabbitMQ');
      channelWrapper = connection.createChannel({
        json: false,
        setup: async (channel: Channel) => {
          // You can set up exchanges and queues here if needed
          console.log('RabbitMQ channel established');
          resolve();
        },
      });
    });

    connection.on('disconnect', (params) => {
      console.error('Disconnected from RabbitMQ:', params.err.stack);
    });

    connection.on('error', (err) => {
        // This handler is for connection errors, not channel errors.
        // The library handles reconnection automatically.
        console.error('RabbitMQ connection error:', err);
        reject(err);
    });
  });
}

export async function publishMessage(exchange: string, routingKey: string, message: any): Promise<void> {
  if (!channelWrapper) {
    if (env.RABBITMQ_URL) {
      console.error('Cannot publish message: RabbitMQ channel not established.');
    }
    return;
  }

  try {
    // The channelWrapper will wait for the connection to be established before sending the message.
    await channelWrapper.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
    console.log(`Message published to exchange ${exchange} with routing key ${routingKey}`);
  } catch (error) {
    console.error('Error publishing message:', error);
  }
}

export async function consumeMessages(queue: string, onMessage: (msg: any) => void): Promise<void> {
  if (!channelWrapper) {
    if (env.RABBITMQ_URL) {
      console.error('Cannot consume messages: RabbitMQ channel not established.');
    }
    return;
  }

  try {
    await channelWrapper.addSetup((channel: Channel) => {
      return Promise.all([
        channel.assertQueue(queue, { durable: true }),
        channel.consume(queue, (msg: ConsumeMessage | null) => {
          if (msg) {
            try {
              const content = JSON.parse(msg.content.toString());
              onMessage(content);
              channel.ack(msg);
            } catch (parseError) {
              console.error('Error parsing message content:', parseError);
              channel.nack(msg, false, false);
            }
          }
        })
      ]);
    });
    console.log(`Started consuming messages from queue ${queue}`);
  } catch (error) {
    console.error('Error consuming messages:', error);
  }
}
