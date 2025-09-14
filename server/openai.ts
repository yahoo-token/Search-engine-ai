import OpenAI from "openai";

// Check if OpenAI API key is available
const isOpenAIAvailable = !!process.env.OPENAI_API_KEY;

const openai = isOpenAIAvailable ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!
}) : null;

// Log OpenAI availability status on startup
if (!isOpenAIAvailable) {
  console.warn("⚠️  OpenAI API key not found. AI features will be disabled. Set OPENAI_API_KEY environment variable to enable AI responses.");
} else {
  console.log("✅ OpenAI API initialized successfully");
}

export interface AISearchResponse {
  summary: string;
  keyPoints: string[];
  relatedQuestions: string[];
  confidence: number;
}

export async function generateAIResponse(query: string, searchResults: any[]): Promise<AISearchResponse> {
  // Return fallback response if OpenAI is not available
  if (!isOpenAIAvailable || !openai) {
    return {
      summary: `Found ${searchResults.length} results for "${query}". AI analysis is currently unavailable - please check the search results below for relevant information.`,
      keyPoints: searchResults.slice(0, 3).map(result => `${result.title}: ${result.description}`),
      relatedQuestions: [
        `More information about ${query}`,
        `Latest updates on ${query}`,
        `Best practices for ${query}`
      ],
      confidence: 0.3,
    };
  }

  try {
    const contextData = searchResults.map(result => ({
      title: result.title,
      description: result.description,
      url: result.url
    })).slice(0, 5); // Limit context to top 5 results

    const prompt = `
    You are an intelligent search assistant for the YHT AI Search Engine (YAS). 
    Analyze the search query "${query}" and the following search results to provide a comprehensive, helpful response.
    
    Search Results Context:
    ${JSON.stringify(contextData, null, 2)}
    
    Please provide a response in JSON format with the following structure:
    {
      "summary": "A clear, comprehensive summary addressing the search query",
      "keyPoints": ["3-5 key bullet points from the search results"],
      "relatedQuestions": ["3 related questions users might ask"],
      "confidence": 0.85
    }
    
    Make the response informative, accurate, and helpful. Focus on actionable insights.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant for YHT AI Search Engine. Provide accurate, comprehensive responses based on search results."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.7,
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      summary: aiResponse.summary || "I couldn't generate a comprehensive response for this query.",
      keyPoints: aiResponse.keyPoints || [],
      relatedQuestions: aiResponse.relatedQuestions || [],
      confidence: aiResponse.confidence || 0.5,
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    
    // Provide helpful error messaging based on error type
    let errorMessage = "I'm unable to generate an AI response at this time.";
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('rate_limit')) {
        errorMessage = "AI service is temporarily over capacity. Please try again in a few minutes.";
      } else if (error.message.includes('auth') || error.message.includes('API key')) {
        errorMessage = "AI service configuration issue. Please contact support if this persists.";
      }
    }
    
    return {
      summary: `${errorMessage} However, I found ${searchResults.length} search results that may help answer your question about "${query}".`,
      keyPoints: searchResults.slice(0, 3).map(result => `${result.title}: ${result.description}`),
      relatedQuestions: [
        `More details about ${query}`,
        `Recent news on ${query}`,
        `How to learn more about ${query}`
      ],
      confidence: 0.2,
    };
  }
}

export async function categorizeSearchQuery(query: string): Promise<string> {
  // Return 'all' category if OpenAI is not available
  if (!isOpenAIAvailable || !openai) {
    // Simple keyword-based categorization as fallback
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('buy') || lowerQuery.includes('shop') || lowerQuery.includes('product') || lowerQuery.includes('price')) {
      return 'shopping';
    }
    if (lowerQuery.includes('company') || lowerQuery.includes('business') || lowerQuery.includes('corp')) {
      return 'companies';
    }
    if (lowerQuery.includes('news') || lowerQuery.includes('breaking') || lowerQuery.includes('latest')) {
      return 'news';
    }
    if (lowerQuery.includes('software') || lowerQuery.includes('saas') || lowerQuery.includes('platform')) {
      return 'saas';
    }
    if (lowerQuery.includes('cloud') || lowerQuery.includes('aws') || lowerQuery.includes('azure')) {
      return 'cloud';
    }
    if (lowerQuery.includes('crypto') || lowerQuery.includes('blockchain') || lowerQuery.includes('web3') || lowerQuery.includes('nft')) {
      return 'web3';
    }
    return 'all';
  }

  try {
    const prompt = `
    Categorize the following search query into one of these categories:
    - shopping: product searches, buying, e-commerce
    - companies: business information, company profiles
    - news: current events, breaking news, articles
    - saas: software as a service, tools, platforms
    - cloud: cloud computing, infrastructure, services
    - web3: blockchain, cryptocurrency, NFTs, DeFi
    - all: general queries that don't fit other categories
    
    Query: "${query}"
    
    Respond with just the category name.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
      temperature: 0.3,
    });

    const category = response.choices[0].message.content?.trim().toLowerCase();
    const validCategories = ["shopping", "companies", "news", "saas", "cloud", "web3", "all"];
    
    return validCategories.includes(category || "") ? category! : "all";
  } catch (error) {
    console.error("Category detection error:", error);
    return "all";
  }
}
