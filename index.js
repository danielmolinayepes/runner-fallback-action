const core = require('@actions/core');
const httpClient = require('@actions/http-client');

async function checkRunner({ token, owner, repo, primaryRunnerLabels, fallbackRunner }) {
  const http = new httpClient.HttpClient('http-client');
  const headers = {
    'Authorization': `Bearer ${token}`,
  };
  console.log("repor", repo)
  const response = await http.getJson(`https://api.github.com/org/${owner}/actions/runners`, headers);

  if (response.statusCode !== 200) {
    return { error: `Failed to get runners. Status code: ${response.statusCode}` };
  }

  const runners = response.result.runners || [];
  let useRunner = fallbackRunner;
  let primaryIsOnline = false;

  for (const runner of runners) {
    if (runner.status === 'online') {
      const runnerLabels = runner.labels.map(label => label.name);
      if (primaryRunnerLabels.every(label => runnerLabels.includes(label))) {
        primaryIsOnline = true;
        useRunner = primaryRunnerLabels.join(',');
        break;
      }
    }
  }

  // return a JSON string so that it can be parsed using `fromJson`, e.g. fromJson('["self-hosted", "linux"]')
  return { useRunner: JSON.stringify(useRunner.split(',')), primaryIsOnline };
}

async function main() {
  const githubRepository = process.env.GITHUB_REPOSITORY;
  const [owner, repo] = githubRepository.split("/");
  const fallbackRunner = core.getInput('fallback-runner', { required: true });
  try {
    const inputs = {
      owner,
      repo,
      token: core.getInput('github-token', { required: true }),
      primaryRunnerLabels: core.getInput('primary-runner', { required: true }).split(','),
      fallbackRunner
    };

    const { useRunner, primaryIsOnline, error } = await checkRunner(inputs);

    if (error) {
      core.info(error);
      core.setOutput('use-runner', fallbackRunner);
      return;
    }

    core.info(`Primary runner is online: ${primaryIsOnline}`);
    core.info(`Using runner: ${useRunner}`);

    core.setOutput('use-runner', useRunner);
  } catch (error) {
    core.info(error);
    core.setOutput('use-runner', fallbackRunner);
  }
}

module.exports = { checkRunner };

if (require.main === module) {
  main();
}
