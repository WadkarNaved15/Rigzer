module.exports = {
  apps: [
    {
      name: "game-worker",
      script: "npm",
      args: "run game-worker",
      cwd: "/home/ubuntu/Rigzer/server",
    },
    {
      name: "snapshot-worker",
      script: "npm",
      args: "run snapshot-worker",
      cwd: "/home/ubuntu/Rigzer/server",
    },
    {
      name: "notification-worker",
      script: "npm",
      args: "run notification-worker",
      cwd: "/home/ubuntu/Rigzer/server",
    },
    {
      name: "view-worker",
      script: "npm",
      args: "run view-worker",
      cwd: "/home/ubuntu/Rigzer/server",
    },
  ],
};