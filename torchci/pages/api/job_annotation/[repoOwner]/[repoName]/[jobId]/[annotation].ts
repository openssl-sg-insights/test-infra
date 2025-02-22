import { NextApiRequest, NextApiResponse } from "next";
import { getDynamoClient } from "lib/dynamo";
import { unstable_getServerSession } from "next-auth";
import { authOptions } from "pages/api/auth/[...nextauth]";

// Get number by going to https://api.github.com/users/<username>
// and copying the "id" field
export const annotationEditAllowlist = new Set([
  "4468967", // ZainRizvi
  "44682903", // clee2000
  "475357", // huydhn
  "420184", // kit1980
  "2453524", // malfet
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(504).end();
  }
  // @ts-ignore
  const session = await unstable_getServerSession(req, res, authOptions);

  // @ts-ignore
  if (!session || !annotationEditAllowlist.has(session.user.id)) {
    return res.status(401).end();
  }
  const client = getDynamoClient();
  const { jobId, repoOwner, repoName, annotation } = req.query;
  const dynamoKey = `${repoOwner}/${repoName}/${jobId}`;

  const item: any = {
    dynamoKey,
    repo: `${repoOwner}/${repoName}`,
    jobID: parseInt(jobId as string),
  };

  // TODO: we encode annotations as a string, but probably we want to just
  // serialize a JSON object instead to avoid this silly special case.
  if (annotation !== "null") {
    item["annotation"] = annotation;
  }

  await client.put({
    TableName: "torchci-job-annotation",
    Item: item,
  });

  return res.status(200).end();
}
