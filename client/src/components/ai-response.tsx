import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Coins, ExternalLink } from "lucide-react";

interface AISearchResponse {
  summary: string;
  keyPoints: string[];
  relatedQuestions: string[];
  confidence: number;
}

interface AIResponseProps {
  response: AISearchResponse;
  tokensEarned: string;
  isLoading: boolean;
}

export default function AIResponse({ response, tokensEarned, isLoading }: AIResponseProps) {
  if (isLoading) {
    return (
      <div className="lg:w-2/5">
        <div className="sticky top-32">
          <Card className="shadow-lg">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleRelatedQuestion = (question: string) => {
    // In a real app, this would trigger a new search
    console.log("Searching for:", question);
  };

  return (
    <div className="lg:w-2/5">
      <div className="sticky top-32 space-y-6">
        {/* AI Response Card */}
        <Card className="shadow-lg" data-testid="card-ai-response">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                <Brain className="w-4 h-4 text-accent-foreground" />
              </div>
              <span>AI Assistant</span>
              <div className="ml-auto">
                <Badge className="bg-accent text-accent-foreground">
                  Powered by YHT AI
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* AI Response Summary */}
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground leading-relaxed" data-testid="text-ai-summary">
                {response.summary}
              </p>
            </div>

            {/* Key Points */}
            {response.keyPoints.length > 0 && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Key Points:</h4>
                <ul className="space-y-2 text-sm">
                  {response.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start space-x-2" data-testid={`text-key-point-${index}`}>
                      <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Confidence Indicator */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Response Confidence:</span>
              <div className="flex items-center space-x-2">
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${response.confidence * 100}%` }}
                  ></div>
                </div>
                <span className="font-medium" data-testid="text-confidence">
                  {Math.round(response.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Related Questions */}
            {response.relatedQuestions.length > 0 && (
              <div className="border-t border-border pt-4">
                <h4 className="font-semibold mb-3">Related Questions</h4>
                <div className="space-y-2">
                  {response.relatedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="text-left text-sm text-primary hover:underline h-auto p-0 justify-start"
                      onClick={() => handleRelatedQuestion(question)}
                      data-testid={`button-related-${index}`}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* YHT Token Reward - Only show if user earned tokens */}
        {parseFloat(tokensEarned) > 0 && (
          <Card className="bg-web3/10 border-web3/20" data-testid="card-token-reward">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Coins className="w-5 h-5 text-web3" />
                <span className="text-sm font-medium">Search Reward</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                You earned YHT tokens for this quality search!
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold text-web3" data-testid="text-tokens-earned">
                  +{tokensEarned} YHT
                </span>
                <Button 
                  variant="link" 
                  className="text-xs text-primary hover:underline p-0 h-auto"
                  data-testid="button-learn-more"
                >
                  Learn more
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Webmaster Tools Snippet */}
        <Card data-testid="card-webmaster-tools">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-3">
              <i className="fas fa-tools text-primary"></i>
              <span className="font-semibold">Webmaster Tools</span>
            </div>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Indexed Pages:</span>
                <span className="font-mono" data-testid="text-indexed-pages">2.3M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Crawl Rate:</span>
                <span className="font-mono" data-testid="text-crawl-rate">45.2K/day</span>
              </div>
              <Button 
                variant="link" 
                className="text-primary text-sm hover:underline p-0 h-auto"
                data-testid="button-webmaster-dashboard"
              >
                View Analytics Dashboard <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
