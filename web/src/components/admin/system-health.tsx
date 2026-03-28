"use client";

import { Activity, CheckCircle, Server, Database, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

type HealthMetric = {
  name: string;
  status: "operational" | "degraded" | "down";
  latency: number;
};

export function SystemHealth() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([
    { name: "Database", status: "operational", latency: 45 },
    { name: "API Gateway", status: "operational", latency: 120 },
    { name: "Auth Service", status: "operational", latency: 85 },
  ]);

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
        setMetrics(prev => prev.map(m => ({
            ...m,
            latency: Math.max(10, m.latency + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 20)),
            status: Math.random() > 0.98 ? "degraded" : "operational" // Occasional blip
        })));
        setLastUpdated(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const overallStatus = metrics.every(m => m.status === "operational") ? "operational" : "degraded";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 h-full flex flex-col shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${overallStatus === 'operational' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                <Activity className="h-6 w-6" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-gray-900">System Health</h2>
                <p className="text-xs text-gray-400">Updated: {lastUpdated.toLocaleTimeString()}</p>
            </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${
            overallStatus === 'operational' 
            ? 'bg-green-50 text-green-700 border-green-200' 
            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
        }`}>
            <span className={`h-2 w-2 rounded-full ${overallStatus === 'operational' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            {overallStatus === 'operational' ? 'System Normal' : 'Degraded Performance'}
        </div>
      </div>

      <div className="space-y-4 flex-1">
        {metrics.map((metric, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                    {metric.name === "Database" && <Database className="h-4 w-4 text-gray-500" />}
                    {metric.name === "API Gateway" && <Wifi className="h-4 w-4 text-gray-500" />}
                    {metric.name === "Auth Service" && <Server className="h-4 w-4 text-gray-500" />}
                    <span className="font-medium text-gray-700">{metric.name}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-400">{metric.latency}ms</span>
                    {metric.status === "operational" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                        <Activity className="h-5 w-5 text-yellow-500" />
                    )}
                </div>
            </div>
        ))}
      </div>
      
      <div className="mt-6 pt-6 border-t border-gray-100">
         <div className="flex justify-between items-center text-sm text-gray-500">
            <span>Uptime (24h)</span>
            <span className="font-semibold text-gray-900">99.98%</span>
         </div>
         <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '99.98%' }}></div>
         </div>
      </div>
    </div>
  );
}
