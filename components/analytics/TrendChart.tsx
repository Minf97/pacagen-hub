"use client";

import React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { TimeSeriesDataPoint } from "@/lib/analytics/types";
import { groupTimeSeriesByDate } from "@/lib/analytics/aggregation";

interface TrendChartProps {
  timeSeriesData: TimeSeriesDataPoint[];
  metricKey: "conversion_rate" | "revenue_per_visitor" | "orders" | "revenue";
  title: string;
  valueFormatter?: (value: number) => string;
}

/**
 * 时间趋势图组件
 * 显示各变体指标随时间的变化趋势
 */
export function TrendChart({
  timeSeriesData,
  metricKey,
  title,
  valueFormatter = (v) => v.toFixed(2),
}: TrendChartProps) {
  // 按日期分组数据
  const groupedData = groupTimeSeriesByDate(timeSeriesData);
  const dates = Object.keys(groupedData).sort();

  // 获取所有唯一的变体 ID
  const variantIds = Array.from(
    new Set(timeSeriesData.map((d) => d.variant_id))
  );

  // 获取所有唯一的变体名称（用于 legend）
  const variantNames = variantIds.map(
    (variantId) =>
      timeSeriesData.find((d) => d.variant_id === variantId)?.variant_name ||
      variantId
  );

  // 为每个变体生成一条折线
  const series = variantIds.map((variantId, index) => {
    const variantName =
      timeSeriesData.find((d) => d.variant_id === variantId)?.variant_name ||
      variantId;

    return {
      name: variantName,
      type: "line",
      smooth: true,
      data: dates.map((date) => {
        const point = groupedData[date][variantId];
        return point ? point[metricKey] : null;
      }),
      itemStyle: {
        color: index === 0 ? "#3b82f6" : "#1e40af", // 第一个（通常是控制组）浅蓝，其他深蓝
      },
    };
  });

  const option: EChartsOption = {
    title: {
      text: `${title} Trend`,
      left: "left",
      textStyle: {
        fontSize: 16,
        fontWeight: "normal",
      },
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: any) => {
        let result = `<div style="padding: 8px"><strong>${params[0].axisValue}</strong><br/>`;
        params.forEach((param: any) => {
          const numValue = typeof param.value === 'number' ? param.value : Number(param.value) || 0;
          result += `${param.marker} ${param.seriesName}: ${valueFormatter(numValue)}<br/>`;
        });
        result += "</div>";
        return result;
      },
    },
    legend: {
      data: variantNames,
      top: 30,
    },
    xAxis: {
      type: "category",
      data: dates,
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      name: title,
      axisLabel: {
        formatter: (value: any) => {
          const numValue = typeof value === 'number' ? value : Number(value) || 0;
          return valueFormatter(numValue);
        },
      },
    },
    series: series as any,
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: 80,
      containLabel: true,
    },
  };

  return (
    <ReactECharts option={option} style={{ height: "400px", width: "100%" }} />
  );
}
