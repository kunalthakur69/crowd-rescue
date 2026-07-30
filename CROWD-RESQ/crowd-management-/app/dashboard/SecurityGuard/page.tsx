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
import { Input } from "@/components/ui/input";
import {
  Bell,
  Send,
  LogOut,
  AlertTriangle,
  Video,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const YOLO_API = "http://localhost:8000";

export default function SecurityGuardDashboard() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState<string[]>([]);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [feedError, setFeedError] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());
  const [videoSource, setVideoSource] = useState<"live" | "recorded">("live");

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/signin");
          return;
        }
        const data = await res.json();
        if (data.user.role !== "SecurityGuard") {
          router.push("/signin");
        } else {
          setUser(data.user);
        }
      } catch {
        router.push("/signin");
      }
    }
    checkAuth();
  }, [router]);

  // Start the raw stream on mount
  useEffect(() => {
    let cancelled = false;
    async function startFeed() {
      try {
        const res = await fetch(`${YOLO_API}/stream/start`, { method: "POST" });
        if (!cancelled && res.ok) {
          // Small delay to let the camera worker produce its first frame
          await new Promise((r) => setTimeout(r, 500));
          setFeedError(false);
          setStreamReady(true);
          setStreamKey(Date.now());
        } else if (!cancelled) {
          setFeedError(true);
        }
      } catch {
        if (!cancelled) setFeedError(true);
      }
    }
    startFeed();
    return () => { cancelled = true; };
  }, []);

  // Retry handler — reset error after 3s and try reconnecting
  useEffect(() => {
    if (!feedError) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${YOLO_API}/stream/start`, { method: "POST" });
        if (res.ok) {
          await new Promise((r) => setTimeout(r, 500));
          setFeedError(false);
          setStreamReady(true);
          setStreamKey(Date.now());
        }
      } catch { /* will retry on next interval */ }
    }, 3000);
    return () => clearTimeout(timer);
  }, [feedError]);

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log("Message sent:", message);
      setMessage("");
      setTimeout(() => {
        setNotifications((prev) => [
          ...prev,
          "Your message has been received. Help is on the way.",
        ]);
      }, 1000);
    }
  };

  const handleEmergencyAlert = () => {
    console.log("Emergency alert triggered");
    setNotifications((prev) => [
      ...prev,
      "Emergency alert sent! Help is on the way.",
    ]);
  };

  const handleMedicalEmergency = () => {
    console.log("Medical emergency alert triggered");
    setNotifications((prev) => [
      ...prev,
      "Medical emergency alert sent! Ambulance has been notified.",
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
          <h1 className="text-xl font-bold">Security Guard Dashboard</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user.name}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Feed with Toggle */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-4 w-4" />
                {videoSource === "live" ? "Live Camera Feed" : "Recorded Video"}
              </CardTitle>
              <CardDescription className="text-xs">
                {videoSource === "live"
                  ? "Real-time camera stream"
                  : "Pre-recorded crowd footage (without path)"}
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
                  Recorded Video
                </Button>
              </div>

              <div className="relative bg-black rounded-md overflow-hidden max-h-[420px] aspect-video">
                {videoSource === "live" ? (
                  feedError ? (
                    <div className="flex flex-col items-center justify-center h-full text-white gap-3">
                      <Video className="h-10 w-10 opacity-50" />
                      <p className="text-sm opacity-70">
                        Cannot connect to camera backend at {YOLO_API}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFeedError(false);
                          setStreamReady(false);
                          setStreamKey(Date.now());
                          fetch(`${YOLO_API}/stream/start`, { method: "POST" })
                            .then((res) => {
                              if (res.ok) {
                                setTimeout(() => {
                                  setStreamReady(true);
                                  setStreamKey(Date.now());
                                }, 500);
                              } else {
                                setFeedError(true);
                              }
                            })
                            .catch(() => setFeedError(true));
                        }}
                      >
                        Retry Connection
                      </Button>
                    </div>
                  ) : !streamReady ? (
                    <div className="flex flex-col items-center justify-center h-full text-white gap-3">
                      <Video className="h-10 w-10 opacity-50 animate-pulse" />
                      <p className="text-sm opacity-70">Connecting to camera...</p>
                    </div>
                  ) : (
                    <img
                      key={streamKey}
                      src={`${YOLO_API}/stream.mjpg?t=${streamKey}`}
                      alt="Live camera feed"
                      className="w-full h-full object-contain"
                      onError={() => setFeedError(true)}
                    />
                  )
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
            </CardContent>
          </Card>

          {/* Emergency + Messaging (stacked in right column) */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Emergency Alerts</CardTitle>
                <CardDescription className="text-xs">
                  Press in case of emergency
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleEmergencyAlert}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Security Emergency
                </Button>
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleMedicalEmergency}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Medical Emergency
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Send Message</CardTitle>
                <CardDescription className="text-xs">
                  Describe the situation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notifications */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Recent alerts and messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notification, index) => (
                  <Alert key={index}>
                    <Bell className="h-4 w-4" />
                    <AlertTitle>Notification</AlertTitle>
                    <AlertDescription>{notification}</AlertDescription>
                  </Alert>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No notifications yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
