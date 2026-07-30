"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bell, LogOut, Video, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// YOLO Backend URL
const YOLO_API = "http://localhost:8000";

export default function AmbulanceDashboard() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<string[]>([]);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [videoSource, setVideoSource] = useState<"live" | "recorded">("live");

  useEffect(() => {
    // Check if user is logged in and is ambulance service via API
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/signin");
          return;
        }
        const data = await res.json();
        if (data.user.role !== "ambulance") {
          router.push("/signin");
        } else {
          setUser(data.user);
        }
      } catch {
        router.push("/signin");
      }
    }
    checkAuth();

    // Simulate receiving emergency alerts
    const timer = setTimeout(() => {
      setNotifications([
        "Medical emergency reported at Main Building, Room 101.",
        "Student reported injury at Sports Field.",
      ]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleEmergencyResponse = () => {
    // In a real app, you would send a response to your backend
    console.log("Emergency response triggered");
    setNotifications((prev) => [
      ...prev,
      "Response team dispatched. ETA: 5 minutes.",
    ]);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/signin");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Ambulance Service Dashboard</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user.name}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Processed Video Feed
              </CardTitle>
              <CardDescription>
                Live AI-processed feed with heatmap and optimal evacuation path
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Toggle buttons */}
              <div className="flex gap-2 mb-3">
                <Button
                  variant={videoSource === "live" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVideoSource("live")}
                >
                  <Video className="mr-1.5 h-4 w-4" />
                  Live Feed
                </Button>
                <Button
                  variant={videoSource === "recorded" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVideoSource("recorded")}
                >
                  <Video className="mr-1.5 h-4 w-4" />
                  Recorded (Ambulance Path)
                </Button>
              </div>

              <div className="aspect-video bg-black rounded-md overflow-hidden relative">
                {videoSource === "live" ? (
                  <img
                    src={`${YOLO_API}/shared/processed.mjpg`}
                    alt="YOLO processed stream with heatmap and path"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    src="/videos/WhatsApp Video 2026-02-15 at 4.39.53 PM.mp4"
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    loop
                    muted
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {videoSource === "live" ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 inline-block animate-pulse" />
                    Live Stream
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    Recorded Video
                  </Badge>
                )}
                <Badge variant="outline">Heatmap Overlay</Badge>
                <Badge variant="outline">A* Evacuation Path</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Response</CardTitle>
              <CardDescription>Respond to emergency alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={handleEmergencyResponse}
              >
                <Bell className="mr-2 h-4 w-4" />
                Dispatch Response Team
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Emergency Notifications</CardTitle>
              <CardDescription>Recent emergency alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notification, index) => (
                  <Alert
                    key={index}
                    variant={index === 0 ? "destructive" : "default"}
                  >
                    <Bell className="h-4 w-4" />
                    <AlertTitle>Emergency Alert</AlertTitle>
                    <AlertDescription>{notification}</AlertDescription>
                  </Alert>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No active emergencies
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
