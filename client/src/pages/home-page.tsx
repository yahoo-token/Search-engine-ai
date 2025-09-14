import { useState, useEffect } from "react";
import SearchHeader from "@/components/search-header.tsx";
import SearchTabs from "@/components/search-tabs.tsx";
import SearchResults from "@/components/search-results.tsx";
import AIResponse from "@/components/ai-response.tsx";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  ranking: number;
}

interface AISearchResponse {
  summary: string;
  keyPoints: string[];
  relatedQuestions: string[];
  confidence: number;
}

interface SearchResponse {
  query: string;
  category: string;
  results: SearchResult[];
  aiResponse: AISearchResponse;
  tokensEarned: string;
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  searchTime: string;
  searchStats?: {
    avgRankScore: number;
    topCategories: Array<{ category: string; count: number }>;
  };
}

interface PopularResponse {
  category: string;
  results: SearchResult[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isPopular: true;
}

export default function HomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [showingPopular, setShowingPopular] = useState(true);

  // Fetch popular results on page load
  const { data: popularResults, isLoading: popularLoading } = useQuery<PopularResponse>({
    queryKey: ["/api/search/popular", activeCategory, currentPage],
    enabled: showingPopular,
    refetchOnWindowFocus: false,
  });

  const searchMutation = useMutation({
    mutationFn: async (data: { query: string; category: string; page: number }) => {
      const res = await apiRequest("POST", "/api/search", data);
      return await res.json();
    },
    onSuccess: (data: SearchResponse) => {
      setSearchResults(data);
      setShowingPopular(false);
      if (user && parseFloat(data.tokensEarned) > 0) {
        toast({
          title: "YHT Tokens Earned!",
          description: `You earned ${data.tokensEarned} YHT tokens for this search.`,
        });
        // Invalidate wallet balance to refresh tokens only if user is logged in
        queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setCurrentPage(1);
    searchMutation.mutate({ query: query.trim(), category: activeCategory, page: 1 });
  };

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setCurrentPage(1);
    if (searchQuery) {
      searchMutation.mutate({ query: searchQuery, category, page: 1 });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (searchQuery && !showingPopular) {
      searchMutation.mutate({ query: searchQuery, category: activeCategory, page });
    }
  };

  // Update popular results when category or page changes
  useEffect(() => {
    if (showingPopular) {
      queryClient.invalidateQueries({ queryKey: ["/api/search/popular", activeCategory, currentPage] });
    }
  }, [activeCategory, currentPage, showingPopular, queryClient]);


  return (
    <div className="min-h-screen bg-background">
      <SearchHeader onSearch={handleSearch} />
      <SearchTabs activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
      
      <main className="pt-32 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {(searchResults || popularResults) ? (
            <div className="flex flex-col lg:flex-row gap-6">
              <SearchResults
                results={showingPopular ? (popularResults?.results || []) : (searchResults?.results || [])}
                query={showingPopular ? undefined : searchResults?.query}
                totalResults={showingPopular ? (popularResults?.totalResults || 0) : (searchResults?.totalResults || 0)}
                searchTime={showingPopular ? undefined : searchResults?.searchTime}
                isLoading={showingPopular ? popularLoading : searchMutation.isPending}
                currentPage={currentPage}
                totalPages={showingPopular ? (popularResults?.totalPages || 1) : (searchResults?.totalPages || 1)}
                hasNextPage={showingPopular ? (popularResults?.hasNextPage || false) : (searchResults?.hasNextPage || false)}
                hasPrevPage={showingPopular ? (popularResults?.hasPrevPage || false) : (searchResults?.hasPrevPage || false)}
                isPopular={showingPopular}
                onPageChange={handlePageChange}
              />
              {!showingPopular && searchResults && (
                <AIResponse
                  response={searchResults.aiResponse}
                  tokensEarned={searchResults.tokensEarned}
                  isLoading={searchMutation.isPending}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-6">
                <i className="fas fa-search text-primary-foreground text-2xl"></i>
              </div>
              <h1 className="text-4xl font-bold text-foreground mb-4">Welcome to YAS</h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
                {user 
                  ? "The intelligent search engine that rewards you with YHT tokens. Search across categorized results and get AI-powered insights." 
                  : "The intelligent search engine powered by AI. Search across categorized results and get AI-powered insights. Sign in to earn YHT tokens!"
                }
              </p>
              <div className="text-sm text-muted-foreground">
                Search to discover websites, or browse popular results below
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
