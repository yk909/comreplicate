import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(request: NextRequest) {

    const url = "https://api.replicate.com/v1/collections";
    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Token ${process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        console.log(response);
        return new NextResponse(JSON.stringify(response.data));
    } catch (error) {
        console.error(error);
        return new NextResponse(
            JSON.stringify({ error: "Failed to fetch models" }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    }
}