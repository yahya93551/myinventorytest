import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  category: z.string().trim().min(1, "Category is required"),
  price: z.number().nonnegative("Price must be 0 or greater"),
  stock: z
    .number()
    .int("Stock must be an integer")
    .nonnegative("Stock cannot be negative"),
});

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  if (!authHeader) {
    return NextResponse.json(
      { error: "Missing authorization token" },
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const parseResult = ProductSchema.safeParse(payload);
  if (!parseResult.success) {
    const message = parseResult.error.issues
      .map((issue) => issue.message)
      .join(", ");
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { name, category, price, stock } = parseResult.data;
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(authHeader);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
  }

  const { data: insertedProduct, error: insertError } = await supabaseAdmin
    .from("products")
    .insert({
      name,
      category,
      price,
      stock,
      user_id: userData.user.id,
    })
    .select()
    .single();

  if (insertError || !insertedProduct) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to add product" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: insertedProduct });
}
