import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Star, Users, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface SearchResult {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  ranking: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  query?: string;
  totalResults: number;
  searchTime?: string;
  isLoading: boolean;
  currentPage?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  isPopular?: boolean;
  onPageChange?: (page: number) => void;
}

export default function SearchResults({ 
  results, 
  query, 
  totalResults, 
  searchTime, 
  isLoading,
  currentPage = 1,
  totalPages = 1,
  hasNextPage = false,
  hasPrevPage = false,
  isPopular = false,
  onPageChange
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex-1 lg:w-3/5">
        <div className="mb-4">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-6">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getDomainFromUrl = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      shopping: "bg-green-100 text-green-800",
      companies: "bg-blue-100 text-blue-800",
      news: "bg-red-100 text-red-800",
      saas: "bg-purple-100 text-purple-800",
      cloud: "bg-cyan-100 text-cyan-800",
      web3: "bg-orange-100 text-orange-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="flex-1 lg:w-3/5">
      {/* Results Info */}
      <div className="mb-4 text-sm text-muted-foreground" data-testid="text-results-info">
        {isPopular ? (
          `Showing popular results (${formatNumber(totalResults)} total)`
        ) : (
          `About ${formatNumber(totalResults)} results (${searchTime} seconds) for "${query}"`
        )}
      </div>

      {/* Search Results */}
      <div className="space-y-6">
        {results.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-muted-foreground">
              <i className="fas fa-search text-4xl mb-4 opacity-50"></i>
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p>Try different keywords or check your spelling.</p>
            </div>
          </Card>
        ) : (
          results.map((result, index) => (
            <Card 
              key={result.id} 
              className="result-card transition-shadow duration-200 hover:shadow-lg"
              data-testid={`card-result-${index}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  {/* Favicon placeholder */}
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-globe text-primary-foreground"></i>
                  </div>
                  
                  <div className="flex-1">
                    {/* URL and Category */}
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-muted-foreground" data-testid={`text-domain-${index}`}>
                        {getDomainFromUrl(result.url)}
                      </span>
                      {result.category !== "general" && (
                        <Badge 
                          variant="secondary" 
                          className={getCategoryColor(result.category)}
                          data-testid={`badge-category-${index}`}
                        >
                          {result.category}
                        </Badge>
                      )}
                      {(index === 0 && !isPopular) && (
                        <Badge className="bg-web3 text-web3-foreground">
                          Featured
                        </Badge>
                      )}
                      {isPopular && index < 3 && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          Popular
                        </Badge>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-primary hover:underline cursor-pointer mb-2">
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2"
                        data-testid={`link-result-${index}`}
                      >
                        <span>{result.title}</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </h3>

                    {/* Description */}
                    <p className="text-foreground text-sm leading-relaxed mb-3" data-testid={`text-description-${index}`}>
                      {result.description}
                    </p>

                    {/* Additional metadata for featured results */}
                    {(index === 0 && !isPopular) && (
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>4.8/5</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>10M+ users</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Est. 2015</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Pagination Controls */}
        {results.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between py-6 border-t border-border">
            <div className="text-sm text-muted-foreground mb-4 sm:mb-0">
              Page {currentPage} of {totalPages}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled={!hasPrevPage}
                onClick={() => onPageChange && onPageChange(currentPage - 1)}
                className="flex items-center space-x-2"
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </Button>
              
              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => onPageChange && onPageChange(pageNum)}
                      data-testid={`button-page-${pageNum}`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                disabled={!hasNextPage}
                onClick={() => onPageChange && onPageChange(currentPage + 1)}
                className="flex items-center space-x-2"
                data-testid="button-next-page"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
