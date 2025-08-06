import { buildSchema } from 'type-graphql';
import { container } from '../di/container';
import { Resolver, Query } from 'type-graphql';

// A dummy resolver to satisfy the NonEmptyArray requirement
@Resolver()
class DummyResolver {
  @Query(() => String)
  hello() {
    return "GraphQL server is running";
  }
}

export async function createGraphQLSchema() {
  const schema = await buildSchema({
    resolvers: [DummyResolver], // User will add their own GraphQL resolvers here
    container: { // Integrate with LightSpringTS DI container
      get: (someClass: any) => {
        // This is a basic implementation. A more robust DI container might be needed.
        return container.resolve(someClass.name);
      },
    },
    validate: false, // Disable validation for the dummy resolver
  });
  return schema;
}
