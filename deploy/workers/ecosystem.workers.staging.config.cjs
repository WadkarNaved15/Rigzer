module.exports = {
  apps: [
    {
      name: "game-worker-dev",
      script: "npm",
      args: "run game-worker",
      cwd: "/home/ubuntu/Rigzer/server",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "snapshot-worker-dev",
      script: "npm",
      args: "run snapshot-worker",
      cwd: "/home/ubuntu/Rigzer/server",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "notification-worker-dev",
      script: "npm",
      args: "run notification-worker",
      cwd: "/home/ubuntu/Rigzer/server",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "view-worker-dev",
      script: "npm",
      args: "run view-worker",
      cwd: "/home/ubuntu/Rigzer/server",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};