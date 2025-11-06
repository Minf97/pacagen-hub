'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { VariantComparison } from '@/lib/analytics/types'

interface CalculationStep {
  step: number
  description: string
  query?: string
  result?: string | number
}

export interface CalculationExplanationProps {
  metricName: string
  formula: string
  steps: CalculationStep[]
  dataSource: string
  example?: {
    input: Record<string, number>
    output: string | number
  }
}

export function CalculationExplanation({
  metricName,
  formula,
  steps,
  dataSource,
  example
}: CalculationExplanationProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors ml-1"
          title="How is this calculated?"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            How is "{metricName}" calculated?
          </DialogTitle>
          <DialogDescription>
            Detailed calculation breakdown and data sources
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Formula */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Formula</h4>
            <div className="p-3 bg-gray-50 border rounded-lg font-mono text-sm">
              {formula}
            </div>
          </div>

          {/* Data Source */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Data Source</h4>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              {dataSource}
            </div>
          </div>

          {/* Calculation Steps */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-3">Calculation Steps</h4>
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.step} className="pl-4 border-l-2 border-gray-300">
                  <div className="font-medium text-sm mb-1">
                    Step {step.step}: {step.description}
                  </div>
                  {step.query && (
                    <div className="p-2 bg-gray-50 border rounded text-xs font-mono mb-2 overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{step.query}</pre>
                    </div>
                  )}
                  {step.result !== undefined && (
                    <div className="text-sm text-gray-600">
                      Result: <span className="font-medium text-gray-900">{step.result}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Example */}
          {example && (
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Example</h4>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                <div className="text-sm">
                  <div className="font-medium text-gray-700 mb-2">Given:</div>
                  <ul className="space-y-1 text-gray-600">
                    {Object.entries(example.input).map(([key, value]) => (
                      <li key={key} className="ml-4">
                        • {key}: {value.toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 border-t border-green-300">
                  <span className="font-medium text-gray-700">Result: </span>
                  <span className="text-lg font-bold text-green-800">{example.output}</span>
                </div>
              </div>
            </div>
          )}

          {/* Data Verification Note */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
            <div className="font-medium text-yellow-900 mb-1">✓ Data Verification</div>
            <div className="text-yellow-700">
              All calculations are performed in real-time from source data.
              You can verify these numbers in the "Data Integrity Audit" section below.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Preset configurations for common metrics
export function getConversionRateExplanation(variant: VariantComparison): CalculationExplanationProps {
  const visitors = variant.visitors
  const orders = variant.orders
  const conversionRate = variant.conversion_rate

  return {
    metricName: 'Conversion Rate',
    formula: 'Conversion Rate = (Total Orders / Unique Visitors) × 100%',
    dataSource: 'user_assignments (visitors) + events (conversions)',
    steps: [
      {
        step: 1,
        description: 'Count unique visitors for this variant',
        query: `SELECT COUNT(DISTINCT user_id)
FROM user_assignments
WHERE experiment_id = $1
  AND variant_id = $2
  AND is_new_visitor = TRUE`,
        result: `${visitors.toLocaleString()} visitors`
      },
      {
        step: 2,
        description: 'Count conversion events for these visitors',
        query: `SELECT COUNT(*)
FROM events e
JOIN user_assignments ua ON e.user_id = ua.user_id
WHERE ua.experiment_id = $1
  AND ua.variant_id = $2
  AND ua.is_new_visitor = TRUE
  AND e.event_type = 'conversion'`,
        result: `${orders.toLocaleString()} orders`
      },
      {
        step: 3,
        description: 'Calculate conversion rate',
        result: `(${orders} / ${visitors.toLocaleString()}) × 100 = ${conversionRate.toFixed(2)}%`
      }
    ],
    example: {
      input: {
        'Unique Visitors': visitors,
        'Total Orders': orders
      },
      output: `${conversionRate.toFixed(2)}%`
    }
  }
}

export function getRevenuePerVisitorExplanation(variant: VariantComparison): CalculationExplanationProps {
  const visitors = variant.visitors
  const revenue = variant.revenue
  const rpv = variant.revenue_per_visitor

  return {
    metricName: 'Revenue per Visitor',
    formula: 'RPV = Total Revenue / Unique Visitors',
    dataSource: 'user_assignments (visitors) + events (revenue)',
    steps: [
      {
        step: 1,
        description: 'Count unique visitors',
        result: `${visitors.toLocaleString()} visitors`
      },
      {
        step: 2,
        description: 'Sum total revenue from conversions',
        query: `SELECT SUM(CAST(event_data->>'orderValue' AS NUMERIC))
FROM events e
JOIN user_assignments ua ON e.user_id = ua.user_id
WHERE ua.experiment_id = $1
  AND ua.variant_id = $2
  AND e.event_type = 'conversion'`,
        result: `$${revenue.toFixed(2)}`
      },
      {
        step: 3,
        description: 'Divide revenue by visitors',
        result: `$${revenue.toFixed(2)} / ${visitors.toLocaleString()} = $${rpv.toFixed(2)}`
      }
    ],
    example: {
      input: {
        'Total Revenue': revenue,
        'Unique Visitors': visitors
      },
      output: `$${rpv.toFixed(2)}`
    }
  }
}

export function getProfitPerVisitorExplanation(variant: VariantComparison): CalculationExplanationProps {
  const visitors = variant.visitors
  const profit = variant.profit_per_visitor * visitors // Calculate total profit from PPV
  const ppv = variant.profit_per_visitor

  return {
    metricName: 'Profit per Visitor',
    formula: 'PPV = Total Profit / Unique Visitors',
    dataSource: 'user_assignments (visitors) + events (profit from order data)',
    steps: [
      {
        step: 1,
        description: 'Count unique visitors',
        result: `${visitors.toLocaleString()} visitors`
      },
      {
        step: 2,
        description: 'Sum total profit from conversions',
        query: `SELECT SUM(
  CAST(event_data->>'orderValue' AS NUMERIC) -
  CAST(event_data->>'totalCost' AS NUMERIC)
)
FROM events e
JOIN user_assignments ua ON e.user_id = ua.user_id
WHERE ua.experiment_id = $1
  AND ua.variant_id = $2
  AND e.event_type = 'conversion'`,
        result: `$${profit.toFixed(2)}`
      },
      {
        step: 3,
        description: 'Divide profit by visitors',
        result: `$${profit.toFixed(2)} / ${visitors.toLocaleString()} = $${ppv.toFixed(2)}`
      }
    ],
    example: {
      input: {
        'Total Profit': profit,
        'Unique Visitors': visitors
      },
      output: `$${ppv.toFixed(2)}`
    }
  }
}

export function getAvgOrderValueExplanation(variant: VariantComparison): CalculationExplanationProps {
  const orders = variant.orders
  const revenue = variant.revenue
  const aov = variant.avg_order_value

  return {
    metricName: 'Average Order Value',
    formula: 'AOV = Total Revenue / Total Orders',
    dataSource: 'events (revenue and order count)',
    steps: [
      {
        step: 1,
        description: 'Count total orders',
        query: `SELECT COUNT(*)
FROM events e
JOIN user_assignments ua ON e.user_id = ua.user_id
WHERE ua.experiment_id = $1
  AND ua.variant_id = $2
  AND e.event_type = 'conversion'`,
        result: `${orders.toLocaleString()} orders`
      },
      {
        step: 2,
        description: 'Sum total revenue',
        result: `$${revenue.toFixed(2)}`
      },
      {
        step: 3,
        description: 'Divide revenue by orders',
        result: `$${revenue.toFixed(2)} / ${orders.toLocaleString()} = $${aov.toFixed(2)}`
      }
    ],
    example: {
      input: {
        'Total Revenue': revenue,
        'Total Orders': orders
      },
      output: `$${aov.toFixed(2)}`
    }
  }
}

