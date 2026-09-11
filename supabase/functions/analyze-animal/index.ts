import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ImageContent = {
  type: "image_url";
  image_url: { url: string };
};

type TextContent = {
  type: "text";
  text: string;
};

type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: Array<ImageContent | TextContent> };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({
        error: "LOVABLE_API_KEY is not configured in Supabase Edge Function secrets. Deploy the function and add the secret via: supabase secrets set LOVABLE_API_KEY=<your-key>"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, poseData } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert veterinary AI assistant specialized in animal health assessment. Analyze the provided image and pose data to give a comprehensive veterinary analysis.

Your response MUST be valid JSON with this exact structure:
{
  "animalType": "string - species/breed identified",
  "confidence": number 0-100,
  "appearance": {
    "bodyCondition": "string - thin/normal/overweight/obese",
    "coatCondition": "string - healthy/dull/patchy/matted",
    "posture": "string - normal/hunched/favoring side/stiff",
    "overallAppearance": "string - detailed description"
  },
  "healthAssessment": {
    "overallStatus": "healthy/mild concern/moderate concern/urgent",
    "possibleIssues": ["string array of detected issues"],
    "painIndicators": ["string array of pain signs if any"],
    "mobilityAssessment": "string - normal/limited/impaired/severely impaired"
  },
  "injuryAnalysis": {
    "visibleInjuries": ["string array"],
    "suspectedInjuries": ["string array based on posture/movement"],
    "affectedAreas": ["string array of body areas"],
    "severity": "none/mild/moderate/severe"
  },
  "healthScores": {
    "overallHealth": number 0-100 (100 = perfectly healthy),
    "lamenessScore": number 0-100 (0 = no lameness, 100 = severe lameness),
    "movementAnomaly": number 0-100 (0 = normal movement, 100 = highly abnormal),
    "stepSymmetry": number 0-100 (100 = perfectly symmetric gait),
    "strideConsistency": number 0-100 (100 = perfectly consistent),
    "bodyConditionScore": number 1-9 (1 = emaciated, 5 = ideal, 9 = obese)
  },
  "vetNotes": "string - concise clinical observations and findings for a veterinarian",
  "recommendations": ["string array of veterinary recommendations"],
  "summary": "string - 2-3 sentence overall summary"
}

IMPORTANT: The healthScores field is REQUIRED. Assess the animal's health numerically based on visible signs:
- overallHealth: Based on all visible indicators (posture, coat, body condition, alertness)
- lamenessScore: Based on weight bearing, limb position, posture asymmetry
- movementAnomaly: Based on body position, stance abnormalities
- stepSymmetry: Based on limb positioning symmetry visible in the image
- strideConsistency: Estimate from visible posture and stance
- bodyConditionScore: Standard veterinary BCS scale

Be thorough but honest. If you cannot determine something from the image, make your best assessment based on visible indicators and note uncertainty.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    const userContent: Array<ImageContent | TextContent> = [];
    
    userContent.push({
      type: "image_url",
      image_url: {
        url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
      },
    });

    let textPrompt = "Analyze this animal image for health assessment. Include numerical health scores.";
    if (poseData) {
      textPrompt += `\n\nPose keypoint data from MediaPipe: ${JSON.stringify(poseData)}`;
    }
    userContent.push({ type: "text", text: textPrompt });

    messages.push({ role: "user", content: userContent });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds at Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let analysis;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = {
        animalType: "Unknown",
        confidence: 0,
        summary: content,
        vetNotes: "",
        appearance: { overallAppearance: content },
        healthAssessment: { overallStatus: "unknown", possibleIssues: [] },
        injuryAnalysis: { severity: "unknown", visibleInjuries: [] },
        healthScores: {
          overallHealth: 50,
          lamenessScore: 0,
          movementAnomaly: 0,
          stepSymmetry: 50,
          strideConsistency: 50,
          bodyConditionScore: 5,
          vetNotes: "Unable to generate clinical notes from AI response.",
        },
        recommendations: ["Consult a veterinarian for proper assessment"],
      };
    }

    if (!analysis.healthScores) {
      const status = analysis.healthAssessment?.overallStatus || "unknown";
      const statusScoreMap: Record<string, number> = {
        healthy: 85,
        "mild concern": 65,
        "moderate concern": 45,
        urgent: 20,
        unknown: 50,
      };
      const severityLamenessMap: Record<string, number> = {
        none: 5,
        mild: 30,
        moderate: 55,
        severe: 80,
        unknown: 20,
      };
      const severity = analysis.injuryAnalysis?.severity || "unknown";

      analysis.healthScores = {
        overallHealth: statusScoreMap[status] || 50,
        lamenessScore: severityLamenessMap[severity] || 20,
        movementAnomaly: status === "healthy" ? 10 : status === "urgent" ? 70 : 30,
        stepSymmetry: status === "healthy" ? 90 : status === "urgent" ? 40 : 65,
        strideConsistency: status === "healthy" ? 88 : status === "urgent" ? 35 : 60,
        bodyConditionScore: 5,
        vetNotes: "",
      };
    }

    if (typeof analysis.vetNotes !== "string") {
      analysis.vetNotes = analysis.healthScores?.vetNotes ?? "";
    }
    if (typeof analysis.healthScores?.vetNotes !== "string") {
      if (!analysis.healthScores) analysis.healthScores = {} as typeof analysis.healthScores;
      analysis.healthScores.vetNotes = analysis.vetNotes || "";
    }

    return new Response(JSON.stringify({ analysis }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-animal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
