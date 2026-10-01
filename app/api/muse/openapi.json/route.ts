// app/api/muse/openapi.json/route.ts
// The description Muse reads to build its connection to the portal.
// Public on purpose (it holds no data); every other /api/muse route needs the token.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Erendira's Boutique Shipping Portal",
      version: "1.0.0",
      description:
        "Packages packed and photographed at Erendira's Boutique. The 'queued' list holds packages the business owner already approved for sending by tapping 'Send with Muse'. " +
        "For each queued package: find the Messenger chat whose name matches customer_name. If exactly one chat matches, send the photo first, then the message text exactly as given, then call markPackageSent. " +
        "If no chat matches, more than one matches, or sending fails, send nothing for that package: call flagPackage with the reason and move on. Never guess who the customer is. " +
        "When asked to work through the queue, finish every package and then report how many were sent and how many were flagged.",
    },
    servers: [{ url: base }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas: {
        Package: {
          type: "object",
          properties: {
            id: { type: "string", description: "Package id, used to mark it sent" },
            order_number: { type: "string", nullable: true, example: "EB-214" },
            customer_name: { type: "string", description: "Customer's name as it appears on the shipping label" },
            city: { type: "string" },
            carrier: { type: "string" },
            tracking_number: { type: "string" },
            tracking_link: { type: "string" },
            photo_url: { type: "string", description: "Public link to the photo of the packed package" },
            message: { type: "string", description: "Bilingual (Spanish then English) message to send after the photo" },
            packed_at: { type: "string", format: "date-time" },
            already_sent: { type: "boolean" },
            sent_at: { type: "string", nullable: true },
            sent_via: { type: "string", nullable: true },
            muse_status: { type: "string", nullable: true, description: "queued, sent, or flagged" },
            flag_reason: { type: "string", nullable: true },
            queued_at: { type: "string", nullable: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/muse/packages": {
        get: {
          operationId: "listPackages",
          summary: "List photographed packages",
          description: "Packages that were scanned and photographed. By default, the ones queued for Muse to send.",
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              description: "queued = approved by the owner and waiting for Muse (use this one); flagged = Muse couldn't send; to_send = any photographed package not sent yet",
              schema: { type: "string", enum: ["queued", "flagged", "to_send", "sent", "all"], default: "queued" },
            },
            {
              name: "days",
              in: "query",
              required: false,
              description: "How many days back to look (1 to 60)",
              schema: { type: "integer", default: 7, minimum: 1, maximum: 60 },
            },
          ],
          responses: {
            "200": {
              description: "Packages",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      count: { type: "integer" },
                      instructions: { type: "string" },
                      packages: { type: "array", items: { $ref: "#/components/schemas/Package" } },
                    },
                  },
                },
              },
            },
            "401": { description: "Missing or wrong token" },
          },
        },
      },
      "/api/muse/packages/{id}/sent": {
        post: {
          operationId: "markPackageSent",
          summary: "Mark a package as sent to the customer",
          description: "Call this right after the photo and message were sent on Messenger.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Recorded (or it was already recorded)" },
            "404": { description: "No package with that id" },
          },
        },
      },
      "/api/muse/packages/{id}/flag": {
        post: {
          operationId: "flagPackage",
          summary: "Flag a package that couldn't be sent",
          description: "Call this instead of sending when the customer's Messenger chat can't be matched to exactly one person, or the send failed. Staff will send it by hand.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["reason"],
                  properties: {
                    reason: { type: "string", enum: ["not_found", "multiple_matches", "send_failed", "other"] },
                    note: { type: "string", description: "Short detail, e.g. which names matched" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Flagged" }, "404": { description: "No package with that id" } },
        },
      },
      "/api/muse/orders": {
        get: {
          operationId: "findOrders",
          summary: "Look up a customer's shipments",
          description: "Search by customer name, EB order number, or tracking number. Use it to answer questions like '¿dónde está mi paquete?'.",
          parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Matching orders, newest first" } },
        },
      },
    },
  };
  return NextResponse.json(spec, { headers: { "Cache-Control": "no-store" } });
}
