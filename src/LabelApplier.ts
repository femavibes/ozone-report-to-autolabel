import { AtpAgent } from "@atproto/api";
import type { LabelCommand } from "./CommandParser";
import { NotificationService } from "./NotificationService";

export class LabelApplier {
  private agent: AtpAgent;
  private labelerDid: string;
  private notificationService: NotificationService;
  private ozoneUrl: string;
  private validLabels: Set<string>;

  constructor(agent: AtpAgent, labelerDid: string, notificationService: NotificationService, ozoneUrl: string, validLabels: string[]) {
    this.agent = agent;
    this.labelerDid = labelerDid;
    this.notificationService = notificationService;
    this.ozoneUrl = ozoneUrl;
    this.validLabels = new Set(validLabels);
  }

  async processCommands(
    commands: LabelCommand[],
    reportedSubject: any,
    reportType: 'post' | 'account',
    moderatorHandle: string,
    moderatorDid: string,
    reportEventId?: number
  ): Promise<void> {
    for (const command of commands) {
      await this.handleLabelCommand(command, reportedSubject, reportType, moderatorHandle, moderatorDid, reportEventId);
    }
  }

  private async handleLabelCommand(
    command: LabelCommand,
    reportedSubject: any,
    reportType: 'post' | 'account',
    moderatorHandle: string,
    moderatorDid: string,
    reportEventId?: number
  ): Promise<void> {
    try {
      // Determine actual target based on command and report type
      const actualTarget = command.target === 'default' ? reportType : command.target;
      
      let subject;
      if (actualTarget === 'account') {
        // Use account subject
        if (reportedSubject.$type === "com.atproto.admin.defs#repoRef") {
          subject = reportedSubject; // Use original subject with all properties
        } else if (reportedSubject.$type === "com.atproto.repo.strongRef") {
          // Extract DID from URI for post reports targeting account
          const uriParts = reportedSubject.uri.split('/');
          const did = uriParts[2]; // at://did:plc:xxx/collection/rkey
          subject = { $type: "com.atproto.admin.defs#repoRef", did };
        } else {
          console.log(`Cannot extract account DID from subject: ${JSON.stringify(reportedSubject)}`);
          return;
        }
      } else {
        // Post target - use original subject
        if (reportedSubject.$type === "com.atproto.repo.strongRef") {
          subject = reportedSubject; // Use original subject with CID
        } else {
          console.log(`Cannot apply post labels to account report: ${JSON.stringify(reportedSubject)}`);
          return;
        }
      }

      console.log(`Applying labels [${command.labels.join(', ')}] to ${actualTarget}: ${JSON.stringify(subject)}`);
      
      const successfulLabels: string[] = [];
      const failedLabels: string[] = [];
      
      // Try each label individually with validation and retry logic
      for (const label of command.labels) {
        // Validate label first
        if (!this.validLabels.has(label)) {
          console.log(`Invalid label: ${label} (not in valid labels list)`);
          failedLabels.push(label);
          continue;
        }
        
        const success = await this.retryLabelOperation(label, command.action, subject, moderatorHandle);
        if (success) {
          successfulLabels.push(label);
          console.log(`Successfully ${command.action}ed label: ${label}`);
        } else {
          failedLabels.push(label);
        }
      }
      
      // Only resolve report if ALL labels succeeded
      if (failedLabels.length === 0) {
        await this.resolveReport(reportedSubject, moderatorHandle);
      }
      
      // Send notification if any labels failed
      console.log(`Label results - Failed: ${failedLabels.length}, Succeeded: ${successfulLabels.length}`);
      if (failedLabels.length > 0) {
        const errorMsg = `Failed: [${failedLabels.join(', ')}]${successfulLabels.length > 0 ? `, Succeeded: [${successfulLabels.join(', ')}]` : ''}`;
        console.log(`Sending error notification to ${moderatorDid}: ${errorMsg}`);
        await this.notificationService.sendErrorNotification(
          moderatorDid,
          errorMsg,
          this.ozoneUrl,
          reportedSubject,
          reportEventId?.toString()
        );
      }
    } catch (error) {
      console.log(`Error in handleLabelCommand: ${error}`);
    }
  }

  private async retryLabelOperation(
    label: string,
    action: 'add' | 'remove',
    subject: any,
    moderatorHandle: string,
    maxRetries: number = 3
  ): Promise<boolean> {
    const isAdd = action === 'add';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.agent.tools.ozone.moderation.emitEvent(
          {
            event: {
              $type: "tools.ozone.moderation.defs#modEventLabel",
              createLabelVals: isAdd ? [label] : [],
              negateLabelVals: isAdd ? [] : [label],
              comment: `Auto-${action}ed by @${moderatorHandle}`,
            },
            subject,
            createdBy: this.labelerDid,
          },
          {
            headers: {
              "atproto-proxy": `${this.labelerDid}#atproto_labeler`,
            },
          }
        );
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Don't retry for invalid label errors
        if (errorMsg.includes('Invalid label') || errorMsg.includes('InvalidRequest') || errorMsg.includes('400')) {
          console.log(`Failed to ${action} label ${label} (invalid label, no retry): ${errorMsg}`);
          return false;
        }
        
        // Retry for network/server errors
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Failed to ${action} label ${label} (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.log(`Failed to ${action} label ${label} after ${maxRetries} attempts: ${errorMsg}`);
          return false;
        }
      }
    }
    return false;
  }

  private async resolveReport(reportedSubject: any, moderatorHandle: string): Promise<void> {
    try {
      await this.agent.tools.ozone.moderation.emitEvent(
        {
          event: {
            $type: "tools.ozone.moderation.defs#modEventAcknowledge",
            comment: `Auto-resolved after labeling by @${moderatorHandle}`,
          },
          subject: reportedSubject,
          createdBy: this.labelerDid,
        },
        {
          headers: {
            "atproto-proxy": `${this.labelerDid}#atproto_labeler`,
          },
        }
      );
      console.log(`Report acknowledged automatically`);
    } catch (error) {
      console.log(`Failed to acknowledge report: ${error}`);
      // Don't send notification for resolve failures - not critical
    }
  }
}