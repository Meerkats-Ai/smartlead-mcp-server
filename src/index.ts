#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  Tool,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Tool definitions
// Campaign management tools
const CREATE_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_create_campaign',
  description: 'Create a new campaign in Smartlead.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the campaign',
      },
      client_id: {
        type: 'number',
        description: 'Client ID for the campaign',
      },
    },
    required: ['name'],
  },
};

const UPDATE_CAMPAIGN_SCHEDULE_TOOL: Tool = {
  name: 'smartlead_update_campaign_schedule',
  description: 'Update a campaign\'s schedule settings.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign to update',
      },
      timezone: {
        type: 'string',
        description: 'Timezone for the campaign (e.g., "America/Los_Angeles")',
      },
      days_of_the_week: {
        type: 'array',
        items: { type: 'number' },
        description: 'Days of the week to send emails (1-7, where 1 is Monday)',
      },
      start_hour: {
        type: 'string',
        description: 'Start hour in 24-hour format (e.g., "09:00")',
      },
      end_hour: {
        type: 'string',
        description: 'End hour in 24-hour format (e.g., "17:00")',
      },
      min_time_btw_emails: {
        type: 'number',
        description: 'Minimum time between emails in minutes',
      },
      max_new_leads_per_day: {
        type: 'number',
        description: 'Maximum number of new leads per day',
      },
      schedule_start_time: {
        type: 'string',
        description: 'Schedule start time in ISO format',
      },
    },
    required: ['campaign_id'],
  },
};

const UPDATE_CAMPAIGN_SETTINGS_TOOL: Tool = {
  name: 'smartlead_update_campaign_settings',
  description: 'Update a campaign\'s general settings.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign to update',
      },
      name: {
        type: 'string',
        description: 'New name for the campaign',
      },
      status: {
        type: 'string',
        enum: ['active', 'paused', 'completed'],
        description: 'Status of the campaign',
      },
      settings: {
        type: 'object',
        description: 'Additional campaign settings',
      },
    },
    required: ['campaign_id'],
  },
};

const GET_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_get_campaign',
  description: 'Get details of a specific campaign by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign to retrieve',
      },
    },
    required: ['campaign_id'],
  },
};

const LIST_CAMPAIGNS_TOOL: Tool = {
  name: 'smartlead_list_campaigns',
  description: 'List all campaigns with optional filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'paused', 'completed', 'all'],
        description: 'Filter campaigns by status',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of campaigns to return',
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
      },
    },
  },
};

// Campaign sequence tools
const SAVE_CAMPAIGN_SEQUENCE_TOOL: Tool = {
  name: 'smartlead_save_campaign_sequence',
  description: 'Save a sequence of emails for a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      sequence: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              description: 'Email subject line',
            },
            body: {
              type: 'string',
              description: 'Email body content',
            },
            wait_days: {
              type: 'number',
              description: 'Days to wait before sending this email',
            },
          },
          required: ['subject', 'body'],
        },
        description: 'Sequence of emails to send',
      },
    },
    required: ['campaign_id', 'sequence'],
  },
};

const GET_CAMPAIGN_SEQUENCE_TOOL: Tool = {
  name: 'smartlead_get_campaign_sequence',
  description: 'Get the sequence of emails for a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
    },
    required: ['campaign_id'],
  },
};

const UPDATE_CAMPAIGN_SEQUENCE_TOOL: Tool = {
  name: 'smartlead_update_campaign_sequence',
  description: 'Update a specific email in a campaign sequence.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      sequence_id: {
        type: 'number',
        description: 'ID of the sequence email to update',
      },
      subject: {
        type: 'string',
        description: 'Updated email subject line',
      },
      body: {
        type: 'string',
        description: 'Updated email body content',
      },
      wait_days: {
        type: 'number',
        description: 'Updated days to wait before sending this email',
      },
    },
    required: ['campaign_id', 'sequence_id'],
  },
};

const DELETE_CAMPAIGN_SEQUENCE_TOOL: Tool = {
  name: 'smartlead_delete_campaign_sequence',
  description: 'Delete a specific email from a campaign sequence.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      sequence_id: {
        type: 'number',
        description: 'ID of the sequence email to delete',
      },
    },
    required: ['campaign_id', 'sequence_id'],
  },
};

// Email account management tools
const ADD_EMAIL_ACCOUNT_TO_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_add_email_account_to_campaign',
  description: 'Add an email account to a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      email_account_id: {
        type: 'number',
        description: 'ID of the email account to add',
      },
    },
    required: ['campaign_id', 'email_account_id'],
  },
};

const UPDATE_EMAIL_ACCOUNT_IN_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_update_email_account_in_campaign',
  description: 'Update an email account in a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      email_account_id: {
        type: 'number',
        description: 'ID of the email account to update',
      },
      settings: {
        type: 'object',
        description: 'Settings for the email account in this campaign',
      },
    },
    required: ['campaign_id', 'email_account_id'],
  },
};

const DELETE_EMAIL_ACCOUNT_FROM_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_delete_email_account_from_campaign',
  description: 'Remove an email account from a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      email_account_id: {
        type: 'number',
        description: 'ID of the email account to remove',
      },
    },
    required: ['campaign_id', 'email_account_id'],
  },
};

// Lead management tools
const ADD_LEAD_TO_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_add_lead_to_campaign',
  description: 'Add a lead to a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      lead: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Email address of the lead',
          },
          first_name: {
            type: 'string',
            description: 'First name of the lead',
          },
          last_name: {
            type: 'string',
            description: 'Last name of the lead',
          },
          company: {
            type: 'string',
            description: 'Company of the lead',
          },
          custom_variables: {
            type: 'object',
            description: 'Custom variables for the lead',
          },
        },
        required: ['email'],
        description: 'Lead information',
      },
    },
    required: ['campaign_id', 'lead'],
  },
};

const UPDATE_LEAD_IN_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_update_lead_in_campaign',
  description: 'Update a lead in a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      lead_id: {
        type: 'number',
        description: 'ID of the lead to update',
      },
      lead: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Email address of the lead',
          },
          first_name: {
            type: 'string',
            description: 'First name of the lead',
          },
          last_name: {
            type: 'string',
            description: 'Last name of the lead',
          },
          company: {
            type: 'string',
            description: 'Company of the lead',
          },
          custom_variables: {
            type: 'object',
            description: 'Custom variables for the lead',
          },
        },
        description: 'Updated lead information',
      },
    },
    required: ['campaign_id', 'lead_id', 'lead'],
  },
};

const DELETE_LEAD_FROM_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_delete_lead_from_campaign',
  description: 'Remove a lead from a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
      lead_id: {
        type: 'number',
        description: 'ID of the lead to remove',
      },
    },
    required: ['campaign_id', 'lead_id'],
  },
};

// Type definitions
// Campaign management types
interface CreateCampaignParams {
  name: string;
  client_id?: number;
}

interface UpdateCampaignScheduleParams {
  campaign_id: number;
  timezone?: string;
  days_of_the_week?: number[];
  start_hour?: string;
  end_hour?: string;
  min_time_btw_emails?: number;
  max_new_leads_per_day?: number;
  schedule_start_time?: string;
}

interface UpdateCampaignSettingsParams {
  campaign_id: number;
  name?: string;
  status?: 'active' | 'paused' | 'completed';
  settings?: Record<string, any>;
}

interface GetCampaignParams {
  campaign_id: number;
}

interface ListCampaignsParams {
  status?: 'active' | 'paused' | 'completed' | 'all';
  limit?: number;
  offset?: number;
}

// Campaign sequence types
interface SaveCampaignSequenceParams {
  campaign_id: number;
  sequence: Array<{
    subject: string;
    body: string;
    wait_days?: number;
  }>;
}

interface GetCampaignSequenceParams {
  campaign_id: number;
}

interface UpdateCampaignSequenceParams {
  campaign_id: number;
  sequence_id: number;
  subject?: string;
  body?: string;
  wait_days?: number;
}

interface DeleteCampaignSequenceParams {
  campaign_id: number;
  sequence_id: number;
}

// Email account management types
interface AddEmailAccountToCampaignParams {
  campaign_id: number;
  email_account_id: number;
}

interface UpdateEmailAccountInCampaignParams {
  campaign_id: number;
  email_account_id: number;
  settings?: Record<string, any>;
}

interface DeleteEmailAccountFromCampaignParams {
  campaign_id: number;
  email_account_id: number;
}

// Lead management types
interface AddLeadToCampaignParams {
  campaign_id: number;
  lead: {
    email: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    custom_variables?: Record<string, any>;
  };
}

interface UpdateLeadInCampaignParams {
  campaign_id: number;
  lead_id: number;
  lead: {
    email?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    custom_variables?: Record<string, any>;
  };
}

interface DeleteLeadFromCampaignParams {
  campaign_id: number;
  lead_id: number;
}

// Type guards
// Campaign management type guards
function isCreateCampaignParams(args: unknown): args is CreateCampaignParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'name' in args &&
    typeof (args as { name: unknown }).name === 'string'
  );
}

function isUpdateCampaignScheduleParams(args: unknown): args is UpdateCampaignScheduleParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number'
  );
}

function isUpdateCampaignSettingsParams(args: unknown): args is UpdateCampaignSettingsParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number'
  );
}

function isGetCampaignParams(args: unknown): args is GetCampaignParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number'
  );
}

function isListCampaignsParams(args: unknown): args is ListCampaignsParams {
  return typeof args === 'object' && args !== null;
}

// Campaign sequence type guards
function isSaveCampaignSequenceParams(args: unknown): args is SaveCampaignSequenceParams {
  if (
    typeof args !== 'object' ||
    args === null ||
    !('campaign_id' in args) ||
    typeof (args as { campaign_id: unknown }).campaign_id !== 'number' ||
    !('sequence' in args) ||
    !Array.isArray((args as { sequence: unknown }).sequence)
  ) {
    return false;
  }

  const sequence = (args as { sequence: unknown[] }).sequence;
  return sequence.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'subject' in item &&
      typeof (item as { subject: unknown }).subject === 'string' &&
      'body' in item &&
      typeof (item as { body: unknown }).body === 'string'
  );
}

function isGetCampaignSequenceParams(args: unknown): args is GetCampaignSequenceParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number'
  );
}

function isUpdateCampaignSequenceParams(args: unknown): args is UpdateCampaignSequenceParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number' &&
    'sequence_id' in args &&
    typeof (args as { sequence_id: unknown }).sequence_id === 'number'
  );
}

function isDeleteCampaignSequenceParams(args: unknown): args is DeleteCampaignSequenceParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number' &&
    'sequence_id' in args &&
    typeof (args as { sequence_id: unknown }).sequence_id === 'number'
  );
}

// Email account management type guards
function isAddEmailAccountToCampaignParams(args: unknown): args is AddEmailAccountToCampaignParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number' &&
    'email_account_id' in args &&
    typeof (args as { email_account_id: unknown }).email_account_id === 'number'
  );
}

function isUpdateEmailAccountInCampaignParams(args: unknown): args is UpdateEmailAccountInCampaignParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number' &&
    'email_account_id' in args &&
    typeof (args as { email_account_id: unknown }).email_account_id === 'number'
  );
}

function isDeleteEmailAccountFromCampaignParams(args: unknown): args is DeleteEmailAccountFromCampaignParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number' &&
    'email_account_id' in args &&
    typeof (args as { email_account_id: unknown }).email_account_id === 'number'
  );
}

// Lead management type guards
function isAddLeadToCampaignParams(args: unknown): args is AddLeadToCampaignParams {
  if (
    typeof args !== 'object' ||
    args === null ||
    !('campaign_id' in args) ||
    typeof (args as { campaign_id: unknown }).campaign_id !== 'number' ||
    !('lead' in args) ||
    typeof (args as { lead: unknown }).lead !== 'object' ||
    (args as { lead: unknown }).lead === null
  ) {
    return false;
  }

  const lead = (args as { lead: unknown }).lead as any;
  return 'email' in lead && typeof lead.email === 'string';
}

function isUpdateLeadInCampaignParams(args: unknown): args is UpdateLeadInCampaignParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number' &&
    'lead_id' in args &&
    typeof (args as { lead_id: unknown }).lead_id === 'number' &&
    'lead' in args &&
    typeof (args as { lead: unknown }).lead === 'object' &&
    (args as { lead: unknown }).lead !== null
  );
}

function isDeleteLeadFromCampaignParams(args: unknown): args is DeleteLeadFromCampaignParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'campaign_id' in args &&
    typeof (args as { campaign_id: unknown }).campaign_id === 'number' &&
    'lead_id' in args &&
    typeof (args as { lead_id: unknown }).lead_id === 'number'
  );
}

// Server implementation
const server = new Server(
  {
    name: 'smartlead-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// Get API key and URL from environment variables
const SMARTLEAD_API_KEY = process.env.SMARTLEAD_API_KEY;
const SMARTLEAD_API_URL = process.env.SMARTLEAD_API_URL || 'https://server.smartlead.ai/api/v1';

// Check if API key is provided
if (!SMARTLEAD_API_KEY) {
  console.error('Error: SMARTLEAD_API_KEY environment variable is required');
  process.exit(1);
}

// Configuration for retries and monitoring
const CONFIG = {
  retry: {
    maxAttempts: Number(process.env.SMARTLEAD_RETRY_MAX_ATTEMPTS) || 3,
    initialDelay: Number(process.env.SMARTLEAD_RETRY_INITIAL_DELAY) || 1000,
    maxDelay: Number(process.env.SMARTLEAD_RETRY_MAX_DELAY) || 10000,
    backoffFactor: Number(process.env.SMARTLEAD_RETRY_BACKOFF_FACTOR) || 2,
  },
};

// Initialize Axios instance for API requests
const apiClient: AxiosInstance = axios.create({
  baseURL: SMARTLEAD_API_URL,
  params: {
    api_key: SMARTLEAD_API_KEY,
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

let isStdioTransport = false;

function safeLog(
  level:
    | 'error'
    | 'debug'
    | 'info'
    | 'notice'
    | 'warning'
    | 'critical'
    | 'alert'
    | 'emergency',
  data: any
): void {
  if (isStdioTransport) {
    // For stdio transport, log to stderr to avoid protocol interference
    console.error(
      `[${level}] ${typeof data === 'object' ? JSON.stringify(data) : data}`
    );
  } else {
    // For other transport types, use the normal logging mechanism
    server.sendLoggingMessage({ level, data });
  }
}

// Add utility function for delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Add retry logic with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  attempt = 1
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const isRateLimit =
      error instanceof Error &&
      (error.message.includes('rate limit') || error.message.includes('429'));

    if (isRateLimit && attempt < CONFIG.retry.maxAttempts) {
      const delayMs = Math.min(
        CONFIG.retry.initialDelay *
          Math.pow(CONFIG.retry.backoffFactor, attempt - 1),
        CONFIG.retry.maxDelay
      );

      safeLog(
        'warning',
        `Rate limit hit for ${context}. Attempt ${attempt}/${CONFIG.retry.maxAttempts}. Retrying in ${delayMs}ms`
      );

      await delay(delayMs);
      return withRetry(operation, context, attempt + 1);
    }

    throw error;
  }
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Campaign management tools
    CREATE_CAMPAIGN_TOOL,
    UPDATE_CAMPAIGN_SCHEDULE_TOOL,
    UPDATE_CAMPAIGN_SETTINGS_TOOL,
    GET_CAMPAIGN_TOOL,
    LIST_CAMPAIGNS_TOOL,
    
    // Campaign sequence tools
    SAVE_CAMPAIGN_SEQUENCE_TOOL,
    GET_CAMPAIGN_SEQUENCE_TOOL,
    UPDATE_CAMPAIGN_SEQUENCE_TOOL,
    DELETE_CAMPAIGN_SEQUENCE_TOOL,
    
    // Email account management tools
    ADD_EMAIL_ACCOUNT_TO_CAMPAIGN_TOOL,
    UPDATE_EMAIL_ACCOUNT_IN_CAMPAIGN_TOOL,
    DELETE_EMAIL_ACCOUNT_FROM_CAMPAIGN_TOOL,
    
    // Lead management tools
    ADD_LEAD_TO_CAMPAIGN_TOOL,
    UPDATE_LEAD_IN_CAMPAIGN_TOOL,
    DELETE_LEAD_FROM_CAMPAIGN_TOOL,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();
  try {
    const { name, arguments: args } = request.params;

    // Log incoming request with timestamp
    safeLog(
      'info',
      `[${new Date().toISOString()}] Received request for tool: ${name}`
    );

    if (!args) {
      throw new Error('No arguments provided');
    }

    switch (name) {
      case 'smartlead_create_campaign': {
        if (!isCreateCampaignParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_create_campaign'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.post('/campaigns/create', args),
            'create campaign'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_update_campaign_schedule': {
        if (!isUpdateCampaignScheduleParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_update_campaign_schedule'
          );
        }

        const { campaign_id, ...scheduleParams } = args;

        try {
          const response = await withRetry(
            async () => apiClient.post(`/campaigns/${campaign_id}`, scheduleParams),
            'update campaign schedule'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_update_campaign_settings': {
        if (!isUpdateCampaignSettingsParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_update_campaign_settings'
          );
        }

        const { campaign_id, ...settingsParams } = args;

        try {
          const response = await withRetry(
            async () => apiClient.patch(`/campaigns/${campaign_id}`, settingsParams),
            'update campaign settings'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_get_campaign': {
        if (!isGetCampaignParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_get_campaign'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.get(`/campaigns/${args.campaign_id}`),
            'get campaign'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_list_campaigns': {
        if (!isListCampaignsParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_list_campaigns'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.get('/campaigns', { params: args }),
            'list campaigns'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      // Campaign sequence handlers
      case 'smartlead_save_campaign_sequence': {
        if (!isSaveCampaignSequenceParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_save_campaign_sequence'
          );
        }

        const { campaign_id, sequence } = args;

        try {
          const response = await withRetry(
            async () => apiClient.post(`/campaigns/${campaign_id}/sequence`, { sequence }),
            'save campaign sequence'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_get_campaign_sequence': {
        if (!isGetCampaignSequenceParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_get_campaign_sequence'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.get(`/campaigns/${args.campaign_id}/sequence`),
            'get campaign sequence'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_update_campaign_sequence': {
        if (!isUpdateCampaignSequenceParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_update_campaign_sequence'
          );
        }

        const { campaign_id, sequence_id, ...updateParams } = args;

        try {
          const response = await withRetry(
            async () => apiClient.patch(`/campaigns/${campaign_id}/sequence/${sequence_id}`, updateParams),
            'update campaign sequence'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_delete_campaign_sequence': {
        if (!isDeleteCampaignSequenceParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_delete_campaign_sequence'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.delete(`/campaigns/${args.campaign_id}/sequence/${args.sequence_id}`),
            'delete campaign sequence'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      // Email account management handlers
      case 'smartlead_add_email_account_to_campaign': {
        if (!isAddEmailAccountToCampaignParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_add_email_account_to_campaign'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.post(`/campaigns/${args.campaign_id}/email-accounts`, {
              email_account_id: args.email_account_id,
            }),
            'add email account to campaign'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_update_email_account_in_campaign': {
        if (!isUpdateEmailAccountInCampaignParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_update_email_account_in_campaign'
          );
        }

        const { campaign_id, email_account_id, settings } = args;

        try {
          const response = await withRetry(
            async () => apiClient.patch(`/campaigns/${campaign_id}/email-accounts/${email_account_id}`, settings || {}),
            'update email account in campaign'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_delete_email_account_from_campaign': {
        if (!isDeleteEmailAccountFromCampaignParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_delete_email_account_from_campaign'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.delete(`/campaigns/${args.campaign_id}/email-accounts/${args.email_account_id}`),
            'delete email account from campaign'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      // Lead management handlers
      case 'smartlead_add_lead_to_campaign': {
        if (!isAddLeadToCampaignParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_add_lead_to_campaign'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.post(`/campaigns/${args.campaign_id}/leads`, {
              leads: [args.lead],
            }),
            'add lead to campaign'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_update_lead_in_campaign': {
        if (!isUpdateLeadInCampaignParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_update_lead_in_campaign'
          );
        }

        const { campaign_id, lead_id, lead } = args;

        try {
          const response = await withRetry(
            async () => apiClient.patch(`/campaigns/${campaign_id}/leads/${lead_id}`, lead),
            'update lead in campaign'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'smartlead_delete_lead_from_campaign': {
        if (!isDeleteLeadFromCampaignParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for smartlead_delete_lead_from_campaign'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.delete(`/campaigns/${args.campaign_id}/leads/${args.lead_id}`),
            'delete lead from campaign'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [
            { type: 'text', text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  } catch (error) {
    // Log detailed error information
    safeLog('error', {
      message: `Request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      tool: request.params.name,
      arguments: request.params.arguments,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    });
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  } finally {
    // Log request completion with performance metrics
    safeLog('info', `Request completed in ${Date.now() - startTime}ms`);
  }
});

// Server startup
async function runServer() {
  try {
    console.error('Initializing Smartlead MCP Server...');

    const transport = new StdioServerTransport();

    // Detect if we're using stdio transport
    isStdioTransport = transport instanceof StdioServerTransport;
    if (isStdioTransport) {
      console.error(
        'Running in stdio mode, logging will be directed to stderr'
      );
    }

    await server.connect(transport);

    // Now that we're connected, we can send logging messages
    safeLog('info', 'Smartlead MCP Server initialized successfully');
    safeLog(
      'info',
      `Configuration: API URL: ${SMARTLEAD_API_URL}`
    );

    console.error('Smartlead MCP Server running on stdio');
  } catch (error) {
    console.error('Fatal error running server:', error);
    process.exit(1);
  }
}

runServer().catch((error: any) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
