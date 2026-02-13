async function main() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "N/A";

  const message = {
    text: `Auto blog pipeline failed. Run URL: ${runUrl}`
  };

  if (!webhookUrl) {
    console.log("SLACK_WEBHOOK_URL is not set. Skipping failure notification.");
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed with status ${response.status}`);
  }

  console.log("Failure notification sent.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
