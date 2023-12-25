import { readFileSync } from "fs";
import { join } from "path";

export const fixturesData = () => {
  const { tables, views } = JSON.parse(
    readFileSync(join(__dirname, "schema_data.json"))
  );
  return { tables, views };
};

let nextFieldId = 3000;

export const withAnotherUserField = () => {
  const { tables, views } = JSON.parse(JSON.stringify(fixturesData()));
  const uiit = tables.find(({ name }) => name === "user_interested_in_topic");
  uiit.foreign_keys.push({
    name: "another_user",
    id: nextFieldId++,
    table_id: uiit.id,
    reftable_name: "users",
    is_unique: false,
  });
  return { tables, views };
};

export const withSecondTopicField = () => {
  const { tables, views } = JSON.parse(JSON.stringify(withAnotherUserField()));
  const bit = tables.find(({ name }) => name === "blog_in_topic");
  bit.foreign_keys.push({
    name: "second_topic",
    id: nextFieldId++,
    table_id: bit.id,
    reftable_name: "topics",
    is_unique: false,
  });
  return { tables, views };
};

export const withMultipleInbounds = () => {
  const { tables, views } = JSON.parse(JSON.stringify(withSecondTopicField()));
  const nextTableId = tables.length + 1;
  tables.push({
    name: "second_inbound",
    id: nextTableId,
    foreign_keys: [
      {
        name: "topic",
        id: nextFieldId++,
        table_id: nextTableId,
        reftable_name: "topics",
        is_unique: false,
      },
      {
        name: "user",
        id: nextFieldId++,
        table_id: nextTableId,
        reftable_name: "users",
        is_unique: false,
      },
    ],
  });
  return { tables, views };
};

export const withKeyFromLayerTwo = () => {
  const { tables, views } = JSON.parse(JSON.stringify(withMultipleInbounds()));
  const inboundInbound = tables.find(({ name }) => name === "inbound_inbound");
  inboundInbound.foreign_keys.push({
    name: "post_from_layer_two",
    id: nextFieldId++,
    table_id: inboundInbound.id,
    reftable_name: "blog_posts",
    is_unique: false,
  });
  return { tables, views };
};

export const withKeyFromLayerThree = () => {
  const { tables, views } = JSON.parse(JSON.stringify(withKeyFromLayerTwo()));
  const nextTableId = tables.length + 1;
  tables.push({
    name: "inbound_level_three",
    id: nextTableId,
    foreign_keys: [
      {
        name: "inbound_level_two",
        id: nextFieldId++,
        table_id: nextTableId,
        reftable_name: "inbound_inbound",
        is_unique: false,
      },
      {
        name: "topic",
        id: nextFieldId++,
        table_id: nextTableId,
        reftable_name: "topics",
        is_unique: false,
      },
    ],
  });
  return { tables, views };
};

export const withSimplePostTopicrelation = () => {
  const { tables, views } = JSON.parse(JSON.stringify(fixturesData()));
  const simpleTopicsId = tables.length + 1;
  const simplePostsId = simpleTopicsId + 1;
  const simplePostInboundId = simplePostsId + 1;
  tables.push({
    name: "simple_posts",
    id: simplePostsId,
    foreign_keys: [
      {
        name: "topic",
        table_id: simplePostsId,
        id: nextFieldId++,
        reftable_name: "simple_topics",
        is_unique: false,
      },
    ],
  });
  tables.push({
    name: "simple_topics",
    id: simpleTopicsId,
    foreign_keys: [],
  });
  tables.push({
    name: "simple_post_inbound",
    id: simplePostInboundId,
    foreign_keys: [
      {
        name: "post",
        table_id: simplePostInboundId,
        id: nextFieldId++,
        reftable_name: "simple_posts",
        is_unique: false,
      },
      {
        name: "topic",
        table_id: simplePostInboundId,
        id: nextFieldId++,
        reftable_name: "simple_topics",
        is_unique: false,
      },
    ],
  });
  const users = tables.find(({ name }) => name === "users");
  users.foreign_keys.push({
    name: "favsimpletopic",
    table_id: users.id,
    id: nextFieldId++,
    reftable_name: "simple_topics",
    is_unique: false,
  });

  views.push({
    name: "simple_posts_list",
    table_id: simplePostsId,
    display_type: "NO_ROW_LIMIT",
  });

  return { tables, views };
};
