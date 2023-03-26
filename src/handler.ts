import { WebClient } from "@slack/web-api";
import { Client } from "@notionhq/client";
import { ScheduledEvent, Context } from "aws-lambda";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notionClient = new Client({
  auth: process.env["NOTION_AUTH"],
});
const slackClient = new WebClient(process.env["SLACK_BOT_TOKEN"]);
const notionDbId = process.env["NOTION_DB_ID"]!;

const extractTitleText = (page: PageObjectResponse) => {
  return page["properties"]["Name"]["title"].reduce(
    (title, titleObject) => (title += titleObject["plain_text"]),
    ""
  );
};

const genYesterdayString = () => {
  const yesterdayJST = new Date(
    Date.now() +
      new Date().getTimezoneOffset() * 60 * 1000 +
      9 * 3600 * 1000 -
      24 * 3600 * 1000
  );
  return yesterdayJST.toISOString().split("T")[0];
};

export const handler = async (event: ScheduledEvent, context: Context) => {
  const yesterday = genYesterdayString();

  const response = await notionClient.databases.query({
    database_id: notionDbId,
    filter: {
      and: [
        {
          property: "created_time",
          date: { equals: yesterday },
        },
      ],
    },
  });

  const pages = response.results as PageObjectResponse[];

  const message = pages
    .filter((page) => {
      return page["properties"]["Name"]["title"].length > 0;
    })
    .map((page) => `<${page["url"]}|${extractTitleText(page)}>`)
    .join("\n");

  if (message) {
    await slackClient.chat.postMessage({
      channel: "#test",
      text: message,
    });
  }

  return {};
};
