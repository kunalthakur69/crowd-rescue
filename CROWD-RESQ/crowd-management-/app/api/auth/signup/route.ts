import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";

export async function POST(request: Request) {
  await connectDB();

  try {
    const { name, email, password, role } = await request.json();

    // Validate required fields
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 },
      );
    }

    // Validate role
    const validRoles = ["student", "SecurityGuard", "ambulance"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: "User already exists" },
        { status: 400 },
      );
    }

    // Password is hashed automatically by the pre-save hook in the User model
    const user = new User({ name, email, password, role });
    await user.save();

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
