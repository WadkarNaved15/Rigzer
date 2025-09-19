import { SSMClient, SendCommandCommand } from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION || "ap-south-1";
const INSTANCE_ID = "i-09c3569c7f9a09586";

const ssmClient = new SSMClient({ region: REGION });

export async function startGameSession(
  gameFolderPath = "C:/Users/Administrator/Desktop"
) {
  try {
    const params = {
      InstanceIds: [INSTANCE_ID],
      DocumentName: "AWS-RunPowerShellScript",   // ✅ Windows
      Comment: "Start game session",
      Parameters: {
        commands: [
          `& "${gameFolderPath}\\start_services.bat"`
        ]
      }
    };

    const command = new SendCommandCommand(params);
    const response = await ssmClient.send(command);
    console.log("SSM Command sent. Command ID:", response.Command.CommandId);
    return response.Command.CommandId;
  } catch (err) {
    console.error("Error sending SSM command:", err);
    throw err;
  }
}
