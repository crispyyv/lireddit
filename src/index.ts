import { MikroORM } from "@mikro-orm/core";
import { ApolloServer } from "apollo-server-express";
import connectRedis from "connect-redis";
import cors from "cors";
import express from "express";
import session from "express-session";
import redis from "redis";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { COOKIE_NAME, __prod__ } from "./constants";
import { User } from "./entities/User";
import microConfig from "./mikro-orm.config";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  await orm.em.nativeDelete(User, {});
  await orm.getMigrator().up();

  const app = express();
  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();
  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redisClient,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, //10 years
        httpOnly: true,
        sameSite: "lax", // csrf protect
        secure: __prod__, //cookie only works in https
      },
      saveUninitialized: false,
      secret: "keyboard cat", //TODO env props
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ em: orm.em, req, res }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.get("/", (_, res) => {
    res.send("hello");
  });
  app.listen(4000, () => {
    console.log("Server started on port 4000....");
  });
};

main().catch((err) => {
  console.error(err);
});
