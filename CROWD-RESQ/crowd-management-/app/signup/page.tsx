"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function SignUp() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, role: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/signin");
      } else {
        setError(data.message || "Signup failed");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError("An error occurred during signup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        className="absolute inset-0 h-full w-full object-cover z-0"
      >
        <source src="/videos/bg.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 z-10" />

      {/* Sign-up Content */}
      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                Create an Account
              </CardTitle>
              <CardDescription className="text-center">
                Enter your information to sign up
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter your name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label>I am a:</Label>
                  <RadioGroup
                    defaultValue="student"
                    value={formData.role}
                    onValueChange={handleRoleChange}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="student" id="student" />
                      <Label htmlFor="student">Student</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="SecurityGuard"
                        id="SecurityGuard"
                      />
                      <Label htmlFor="SecurityGuard">Security Guard</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ambulance" id="ambulance" />
                      <Label htmlFor="ambulance">Ambulance Service</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing up..." : "Sign Up"}
                </Button>
                <div className="text-center text-sm">
                  Already have an account?{" "}
                  <Link href="/signin" className="text-primary underline">
                    Sign In
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
