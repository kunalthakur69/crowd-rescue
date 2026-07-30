


import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
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

      {/* Content */}
      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Emergency Response System</CardTitle>
              <CardDescription>Sign in or create an account to continue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full">
                <Link href="/signin">Sign In</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </CardContent>
            <CardFooter className="text-center text-sm text-muted-foreground">
              A platform for students, Security Management, and Ambulance Services
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  )
}

