import { AtpAgent } from "@atproto/api";
import { CommandParser } from "./CommandParser";
import { LabelApplier } from "./LabelApplier";
import { NotificationService } from "./NotificationService";
import type { ModEventView } from "@atproto/api/dist/client/types/tools/ozone/moderation/defs";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

async function main() {
  // Load environment variables
  const labelerUsername = getRequiredEnv("BSKY_LABELER_USERNAME");
  const labelerPassword = getRequiredEnv("BSKY_LABELER_PASSWORD");
  const labelerDid = getRequiredEnv("BSKY_LABELER_DID");
  const dmUsername = getRequiredEnv("BSKY_DM_USERNAME");
  const dmPassword = getRequiredEnv("BSKY_DM_PASSWORD");
  const ozoneUrl = getRequiredEnv("OZONE_URL");
  const pollingSeconds = parseInt(getRequiredEnv("POLLING_SECONDS"));
  const whitelistedModerators = getRequiredEnv("WHITELISTED_MODERATORS").split(",").map(did => did.trim());
  const moderatorNotifications = process.env.MODERATOR_NOTIFICATIONS || "";
  const validLabels = getRequiredEnv("VALID_LABELS").split(",").map(label => label.trim());

  // Load report type auto-labels
  const reportTypeLabels = {
    "com.atproto.moderation.defs#reasonMisleading": process.env.REPORT_TYPE_MISLEADING?.split(",").map(l => l.trim()).filter(l => l) || [],
    "com.atproto.moderation.defs#reasonSpam": process.env.REPORT_TYPE_SPAM?.split(",").map(l => l.trim()).filter(l => l) || [],
    "com.atproto.moderation.defs#reasonSexual": process.env.REPORT_TYPE_SEXUAL?.split(",").map(l => l.trim()).filter(l => l) || [],
    "com.atproto.moderation.defs#reasonRude": process.env.REPORT_TYPE_RUDE?.split(",").map(l => l.trim()).filter(l => l) || [],
    "com.atproto.moderation.defs#reasonViolation": process.env.REPORT_TYPE_VIOLATION?.split(",").map(l => l.trim()).filter(l => l) || [],
    "com.atproto.moderation.defs#reasonOther": process.env.REPORT_TYPE_OTHER?.split(",").map(l => l.trim()).filter(l => l) || [],
  };

  console.log(`Starting auto-labeler with ${whitelistedModerators.length} whitelisted moderators`);
  console.log(`Valid labels: [${validLabels.join(', ')}]`);
  console.log(`Report type auto-labels configured:`, reportTypeLabels);

  // Initialize AT Protocol agent for Ozone with session persistence
  const agent = new AtpAgent({ 
    service: "https://bsky.social",
    persistSession: (evt, session) => {
      console.log(`Ozone agent session event: ${evt}`);
    }
  });
  await agent.login({
    identifier: labelerUsername,
    password: labelerPassword,
  });
  console.log("Authenticated with AT Protocol");

  // Initialize services
  const notificationService = new NotificationService(dmUsername, dmPassword, moderatorNotifications, whitelistedModerators);
  
  // Initialize DM agent
  console.log("Initializing DM agent...");
  await notificationService.initializeDMAgent();
  const labelApplier = new LabelApplier(agent, labelerDid, notificationService, ozoneUrl, validLabels);

  // Health check server
  Bun.serve({
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/health") return new Response("OK");
      return new Response("404", { status: 404 });
    },
  });

  let lastProcessedId = 0;
  let isFirstRun = true;

  console.log("Starting report monitoring...");

  while (true) {
    try {
      const response = await agent.tools.ozone.moderation.queryEvents(
        {},
        {
          headers: {
            "atproto-proxy": `${labelerDid}#atproto_labeler`,
          },
        }
      );

      const events = response.data.events;
      
      for (const event of events) {
        if (event.event.$type !== "tools.ozone.moderation.defs#modEventReport") {
          continue;
        }
        
        // On first run, only process the latest event to establish baseline
        if (isFirstRun) {
          if (event.id > lastProcessedId) {
            lastProcessedId = event.id;
          }
          continue;
        }
        
        // Only process events newer than what we've seen
        if (event.id > lastProcessedId) {
          await processReport(event);
          lastProcessedId = event.id;
        }
      }
      
      if (isFirstRun) {
        isFirstRun = false;
        console.log(`Established baseline at event ID: ${lastProcessedId}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`Failed to query moderation events: ${errorMsg}`);
      
      if (errorMsg.includes('ExpiredToken') || errorMsg.includes('Unauthorized')) {
        console.log('Ozone agent token may be expired, attempting re-login...');
        try {
          await agent.login({
            identifier: labelerUsername,
            password: labelerPassword,
          });
          console.log('Ozone agent re-authenticated successfully');
        } catch (loginError) {
          console.log(`Failed to re-authenticate Ozone agent: ${loginError}`);
        }
      }
    }

    await Bun.sleep(pollingSeconds * 1000);
  }

  async function processReport(event: ModEventView) {
    // Check if reporter is whitelisted
    if (!whitelistedModerators.includes(event.createdBy)) {
      console.log(`Ignoring report from non-whitelisted user: ${event.createdBy}`);
      return;
    }

    const comment = event.event.comment;
    const reportTypeReason = event.event.reportType;
    
    let commands = [];
    
    // Parse commands from comment if present
    if (comment) {
      commands = CommandParser.parse(comment);
    }
    
    // Check for report type auto-labels
    const autoLabels = reportTypeLabels[reportTypeReason] || [];
    if (autoLabels.length > 0) {
      commands.push({ action: 'add', target: 'default', labels: autoLabels });
      console.log(`Added auto-labels for report type "${reportTypeReason}": [${autoLabels.join(', ')}]`);
    }
    
    if (commands.length === 0) {
      console.log(`No commands or auto-labels for report type "${reportTypeReason}" with comment: "${comment || 'none'}"`);
      return;
    }

    console.log(`Processing ${commands.length} commands from ${event.creatorHandle} (type: ${reportTypeReason}): "${comment || 'auto-label'}"`);

    // Determine report type
    const reportType = event.subject.$type === "com.atproto.admin.defs#repoRef" ? "account" : "post";
    
    // Process commands
    await labelApplier.processCommands(commands, event.subject, reportType, event.creatorHandle, event.createdBy, event.id);
  }
}

main().catch(console.error);