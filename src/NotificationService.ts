import { AtpAgent } from "@atproto/api";

export interface NotificationPreference {
  did: string;
  method: 'dm';
}

export class NotificationService {
  private dmAgent: AtpAgent;
  private preferences: Map<string, NotificationPreference> = new Map();
  private whitelistedModerators: Set<string>;
  private notifiedReports: Set<string> = new Set();

  private dmUsername: string;
  private dmPassword: string;

  constructor(labelerUsername: string, labelerPassword: string, preferencesString: string, whitelistedModerators: string[]) {
    this.dmUsername = labelerUsername;
    this.dmPassword = labelerPassword;
    this.whitelistedModerators = new Set(whitelistedModerators);
    this.parsePreferences(preferencesString);
  }

  async initializeDMAgent() {
    const username = this.dmUsername;
    const password = this.dmPassword;
    
    console.log(`Attempting DM agent login with username: ${username}`);
    
    try {
      // Try with fresh agent and explicit service
      this.dmAgent = new AtpAgent({ 
        service: "https://bsky.social",
        persistSession: (evt, session) => {
          console.log('Session event:', evt);
        }
      });
      
      console.log('Created DM agent, attempting login...');
      
      const loginResult = await this.dmAgent.login({ 
        identifier: username, 
        password: password 
      });
      
      console.log(`DM agent login successful!`);
      console.log(`Session DID: ${this.dmAgent.session?.did}`);
      console.log(`Session handle: ${this.dmAgent.session?.handle}`);
      
      // Test chat API with direct HTTP request
      try {
        console.log('Testing chat API with direct HTTP request...');
        
        const accessJwt = this.dmAgent.session?.accessJwt;
        if (!accessJwt) {
          throw new Error('No access token available');
        }
        
        const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=1', {
          headers: {
            'Authorization': `Bearer ${accessJwt}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Direct HTTP chat API works! Found ${data.convos?.length || 0} conversations`);
          return;
        } else {
          const errorText = await response.text();
          console.log(`Direct HTTP chat API failed: ${response.status} ${errorText}`);
        }
        
      } catch (chatError) {
        console.log(`Chat API test failed: ${chatError}`);
        // Don't throw - let the app continue without DMs
      }
      
    } catch (error) {
      console.log(`DM agent initialization failed: ${error}`);
      if (error instanceof Error) {
        console.log(`Error message: ${error.message}`);
        console.log(`Error stack: ${error.stack}`);
      }
      this.dmAgent = null;
    }
  }

  private parsePreferences(preferencesString: string) {
    const entries = preferencesString.split(',').map(entry => entry.trim());
    
    for (const entry of entries) {
      const [did, method] = entry.split(':');
      if (did && method === 'dm') {
        this.preferences.set(did, { did, method: 'dm' });
      }
    }
  }

  async sendErrorNotification(
    moderatorDid: string, 
    error: string, 
    ozoneUrl: string, 
    reportSubject: any,
    reportId?: string
  ): Promise<void> {
    console.log(`sendErrorNotification called for ${moderatorDid}`);
    
    // Check if we've already notified about this report in this session
    if (reportId && this.notifiedReports.has(reportId)) {
      console.log(`Already notified about report ${reportId} in this session, skipping`);
      return;
    }
    
    let preference = this.preferences.get(moderatorDid);
    
    // Default to DM for whitelisted moderators if no specific preference
    if (!preference && this.whitelistedModerators.has(moderatorDid)) {
      preference = { did: moderatorDid, method: 'dm' };
      console.log(`Using default DM preference for whitelisted moderator ${moderatorDid}`);
    }
    
    if (!preference) {
      console.log(`No notification preference found for ${moderatorDid} and not whitelisted`);
      return;
    }
    console.log(`Using preference for ${moderatorDid}: ${preference.method}`);

    const reportLink = `${ozoneUrl}/reports?quickOpen=${encodeURIComponent(
      reportSubject.uri ?? reportSubject.did ?? ""
    )}`;

    const message = `❌ Auto-label failed: ${error}\n\nReport: ${reportLink}`;
    const facets = [{
      index: {
        byteStart: message.lastIndexOf(reportLink),
        byteEnd: message.lastIndexOf(reportLink) + reportLink.length
      },
      features: [{
        $type: 'app.bsky.richtext.facet#link',
        uri: reportLink
      }]
    }];

    if (preference.method === 'dm') {
      await this.sendDM(moderatorDid, message, facets);
      
      // Mark as notified in this session
      if (reportId) {
        this.notifiedReports.add(reportId);
      }
    }
  }



  private async sendDM(recipientDid: string, message: string, facets?: any[]): Promise<void> {
    if (!this.dmAgent) {
      console.log(`DM agent not initialized, cannot send DM to ${recipientDid}`);
      return;
    }
    
    try {
      // Check if token is expired and refresh if needed
      await this.ensureValidSession();
      
      const convoId = await this.getOrCreateConvo(recipientDid);
      const accessJwt = this.dmAgent.session?.accessJwt;
      
      if (!accessJwt) {
        throw new Error('No access token available');
      }
      
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.sendMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessJwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convoId,
          message: {
            text: message,
            facets: facets || []
          }
        })
      });
      
      if (response.ok) {
        console.log(`Sent DM to ${recipientDid}`);
      } else {
        const errorText = await response.text();
        
        // If token expired, try refreshing and retry once
        if (errorText.includes('ExpiredToken')) {
          console.log('Token expired, refreshing session and retrying...');
          await this.refreshSession();
          
          const retryResponse = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.sendMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.dmAgent.session?.accessJwt}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              convoId,
              message: {
                text: message,
                facets: facets || []
              }
            })
          });
          
          if (retryResponse.ok) {
            console.log(`Sent DM to ${recipientDid} after token refresh`);
          } else {
            const retryErrorText = await retryResponse.text();
            throw new Error(`HTTP ${retryResponse.status}: ${retryErrorText}`);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }
    } catch (error) {
      console.log(`Failed to send DM to ${recipientDid}: ${error}`);
    }
  }

  private async getOrCreateConvo(recipientDid: string): Promise<string> {
    try {
      const accessJwt = this.dmAgent.session?.accessJwt;
      if (!accessJwt) {
        throw new Error('No access token available');
      }
      
      // Try to find existing conversation
      const listResponse = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos', {
        headers: {
          'Authorization': `Bearer ${accessJwt}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (listResponse.ok) {
        const data = await listResponse.json();
        const existingConvo = data.convos?.find((convo: any) => 
          convo.members?.some((member: any) => member.did === recipientDid)
        );
        
        if (existingConvo) {
          return existingConvo.id;
        }
      }

      // Create new conversation
      const createResponse = await fetch(`https://api.bsky.chat/xrpc/chat.bsky.convo.getConvoForMembers?members=${encodeURIComponent(recipientDid)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessJwt}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (createResponse.ok) {
        const data = await createResponse.json();
        return data.convo.id;
      } else {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create convo: HTTP ${createResponse.status}: ${errorText}`);
      }
    } catch (error) {
      console.log(`Failed to get/create convo with ${recipientDid}: ${error}`);
      throw error;
    }
  }

  private async ensureValidSession(): Promise<void> {
    if (!this.dmAgent?.session) {
      throw new Error('No session available');
    }
    
    // Check if session is still valid by making a simple API call
    try {
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=1', {
        headers: {
          'Authorization': `Bearer ${this.dmAgent.session.accessJwt}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('ExpiredToken')) {
          await this.refreshSession();
        }
      }
    } catch (error) {
      console.log(`Session validation failed: ${error}`);
    }
  }

  private async refreshSession(): Promise<void> {
    if (!this.dmAgent?.session?.refreshJwt) {
      console.log('No refresh token available, re-initializing DM agent');
      await this.initializeDMAgent();
      return;
    }
    
    try {
      console.log('Refreshing session token...');
      const response = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.dmAgent.session.refreshJwt}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.dmAgent.session = {
          ...this.dmAgent.session,
          accessJwt: data.accessJwt,
          refreshJwt: data.refreshJwt
        };
        console.log('Session refreshed successfully');
      } else {
        console.log('Session refresh failed, re-initializing DM agent');
        await this.initializeDMAgent();
      }
    } catch (error) {
      console.log(`Session refresh error: ${error}, re-initializing DM agent`);
      await this.initializeDMAgent();
    }
  }
}