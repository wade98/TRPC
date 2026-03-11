import type { EndpointRunner } from "../runner";
import type { CollectedIds } from "../types";

export async function runArticleWorkflow(
  runner: EndpointRunner,
  ids: CollectedIds
): Promise<void> {
  const articles =
    runner.getResponse("article.getArticlesPaginated") ??
    (await runner.loadOrFetch("article.getArticlesPaginated", {
      type: "last",
      limit: runner.sampleSize,
    }));

  const articleId = runner.resolveId(
    articles,
    ["articleId", "_id", "id"],
    "WARERA_ARTICLE_ID"
  );
  ids.articleId = articleId;

  if (articleId) {
    await runner.loadOrFetch("article.getArticleById", { articleId });
  }

  const articleIds = runner.extractTopLevelItemIds(
    articles,
    ["articleId", "_id", "id"],
    runner.sampleSize
  );

  for (const sampledArticleId of articleIds) {
    await runner.loadOrFetch("article.getArticleById", { articleId: sampledArticleId }, true);
    await runner.loadOrFetch("article.getArticleLiteById", { articleId: sampledArticleId }, true);
  }

  const articleAuthorIds = runner.extractTopLevelItemIds(
    articles,
    ["author", "userId"],
    runner.sampleSize
  );

  for (const authorUserId of articleAuthorIds) {
    await runner.loadOrFetch("user.getUserLite", { userId: authorUserId }, true);
  }
}
