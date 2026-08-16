import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { supabaseTarget } from './supabaseClient.js'
import { registerEnquiryTools } from './tools/enquiries.js'
import { registerBookingTools } from './tools/bookings.js'
import { registerPendingActionsTools } from './tools/pendingActions.js'
import { registerAccountingTools } from './tools/accounting.js'

const server = new McpServer({ name: 'bkc-mcp-server', version: '0.1.0' })

registerEnquiryTools(server)
registerBookingTools(server)
registerPendingActionsTools(server)
registerAccountingTools(server)

// stdout is the MCP transport — never console.log here, stderr only.
console.error(`[bkc-mcp-server] starting, SUPABASE_TARGET=${supabaseTarget}`)

const transport = new StdioServerTransport()
await server.connect(transport)
