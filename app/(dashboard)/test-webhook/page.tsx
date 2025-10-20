"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Send } from "lucide-react";

// Mock Shopify webhook data
import { MOCK_WEBHOOK_DATA } from "@/lib/utils";

export default function TestWebhookPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

  // Form fields for A/B test data
  const [userId, setUserId] = useState(MOCK_WEBHOOK_DATA.note_attributes.find(attr => attr.name === "pacagen_hub_ab_user_id")?.value);
  const [variantId, setVariantId] = useState(MOCK_WEBHOOK_DATA.note_attributes.find(attr => attr.name === "pacagen_hub_ab_variant_id")?.value);
  const [experimentId, setExperimentId] = useState(MOCK_WEBHOOK_DATA.note_attributes.find(attr => attr.name === "pacagen_hub_ab_experiment_id")?.value);

  const handleSendWebhook = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Add A/B test data to note_attributes
      const webhookData = {
        ...MOCK_WEBHOOK_DATA,
        note_attributes: [
          { name: "pacagen_hub_ab_user_id", value: userId },
          { name: "pacagen_hub_ab_variant_id", value: variantId },
          { name: "pacagen_hub_ab_experiment_id", value: experimentId },
        ],
      };

      const response = await fetch("/api/webhooks/shopify/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Hmac-Sha256": "test-hmac-signature", // Mock HMAC
        },
        body: JSON.stringify(webhookData),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: data.message, data: data.data });
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to send webhook",
        });
      }
    } catch (error) {
      console.error("Error sending webhook:", error);
      setResult({
        success: false,
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Webhook Test Page</h1>
        <p className="text-muted-foreground">
          Test the Shopify order webhook with mock data and A/B test parameters
        </p>
      </div>

      <div className="grid gap-6">
        {/* A/B Test Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>A/B Test Configuration</CardTitle>
            <CardDescription>
              Enter the experiment and variant IDs to test conversion tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="test-user-123"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier for the test user
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experimentId">Experiment ID (Optional)</Label>
              <Input
                id="experimentId"
                value={experimentId}
                onChange={(e) => setExperimentId(e.target.value)}
                placeholder="uuid-of-experiment"
              />
              <p className="text-xs text-muted-foreground">
                The UUID of your experiment from the experiments table
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="variantId">Variant ID *</Label>
              <Input
                id="variantId"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                placeholder="uuid-of-variant"
                required
              />
              <p className="text-xs text-muted-foreground">
                The UUID of the variant from the variants table (required)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mock Order Data Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Mock Order Data</CardTitle>
            <CardDescription>
              Preview of the Shopify order data that will be sent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Order ID:</span>{" "}
                  {MOCK_WEBHOOK_DATA.id}
                </div>
                <div>
                  <span className="font-medium">Total:</span> $
                  {MOCK_WEBHOOK_DATA.total_price} {MOCK_WEBHOOK_DATA.currency}
                </div>
                <div>
                  <span className="font-medium">Email:</span>{" "}
                  {MOCK_WEBHOOK_DATA.email}
                </div>
                <div>
                  <span className="font-medium">Items:</span>{" "}
                  {MOCK_WEBHOOK_DATA.line_items.length}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Line Items:</Label>
                <ul className="space-y-1 text-sm">
                  {MOCK_WEBHOOK_DATA.line_items.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{item.title}</span>
                      <span className="text-muted-foreground">
                        ${item.price}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  View Full JSON Payload
                </summary>
                <Textarea
                  className="mt-2 font-mono text-xs"
                  rows={10}
                  value={JSON.stringify(MOCK_WEBHOOK_DATA, null, 2)}
                  readOnly
                />
              </details>
            </div>
          </CardContent>
        </Card>

        {/* Send Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSendWebhook}
            disabled={loading || !variantId}
            size="lg"
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Webhook...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test Webhook
              </>
            )}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>
              <p className="mb-2">{result.message}</p>
              {result.data && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
