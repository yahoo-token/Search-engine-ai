import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import WalletModal from "@/components/wallet-modal";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Mic, User, LogOut, TrendingUp, TrendingDown, Plus } from "lucide-react";

interface SearchHeaderProps {
  onSearch: (query: string) => void;
}

interface WalletData {
  balance: string;
  contractAddress: string;
}

interface YHTPrice {
  price: number;
  priceFormatted: string;
  change24h: number;
  source: string;
  timestamp: string;
  contractAddress: string;
  cached?: boolean;
  cacheAge?: number;
  error?: string;
}

export default function SearchHeader({ onSearch }: SearchHeaderProps) {
  const { user, logoutMutation } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);

  const { data: walletData } = useQuery<WalletData>({
    queryKey: ["/api/wallet/balance"],
    enabled: !!user,
  });

  // Fetch YHT price with auto-refresh every 60 seconds (matches server cache)
  const { data: priceData, isLoading: isPriceLoading, error: priceError } = useQuery<YHTPrice>({
    queryKey: ["/api/yht-price"],
    refetchInterval: 60000, // Refresh every 60 seconds to match server cache
    staleTime: 55000, // Consider stale after 55 seconds
    retry: 2,
    retryDelay: 1000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e as any);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-background border-b border-border z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <img 
                  src="/assets/yht-logo.png" 
                  alt="YHT Logo" 
                  className="w-8 h-8"
                />
                <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  YAS
                </span>
              </div>
              
              {/* YHT Price Display */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-full border border-primary/20" data-testid="yht-price-display">
                {isPriceLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="text-sm font-mono text-muted-foreground">Loading...</span>
                  </div>
                ) : priceData ? (
                  <>
                    <span className="text-sm font-mono font-semibold text-foreground" data-testid="text-yht-price">
                      {priceData.priceFormatted}
                    </span>
                    {priceData.change24h !== 0 && (
                      <div className={`flex items-center space-x-1 ${
                        priceData.change24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {priceData.change24h >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span className="text-xs font-medium" data-testid="text-price-change">
                          {Math.abs(priceData.change24h).toFixed(2)}%
                        </span>
                      </div>
                    )}
                    {priceData.cached && (
                      <span className="text-xs text-blue-500 dark:text-blue-400" title="Cached data">
                        📊
                      </span>
                    )}
                  </>
                ) : priceError ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-red-600 dark:text-red-400">—</span>
                    <span className="text-xs text-red-500 dark:text-red-400" title="Service unavailable">
                      ⚠
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl mx-8">
              <form onSubmit={handleSearch} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Search the intelligent web..."
                  className="w-full pl-10 pr-12 py-3 border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent search-shadow"
                  data-testid="input-search"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="p-2 hover:bg-muted rounded-full"
                    data-testid="button-voice-search"
                  >
                    <Mic className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </form>
            </div>

            {/* User Actions */}
            <div className="flex items-center space-x-4">
              {/* Submit Website Button */}
              <Link href="/submit">
                <Button
                  variant="outline"
                  className="flex items-center space-x-2"
                  data-testid="button-submit-nav"
                >
                  <Plus className="w-4 h-4" />
                  <span>Submit Website</span>
                </Button>
              </Link>

              {/* Web3 Wallet Integration - Only show for logged in users */}
              {user && (
                <Button
                  onClick={() => setShowWalletModal(true)}
                  className="flex items-center space-x-2 bg-web3 text-web3-foreground hover:bg-web3/90"
                  data-testid="button-wallet"
                >
                  <i className="fas fa-wallet text-sm"></i>
                  <span className="font-mono text-sm">
                    {walletData?.balance ? `${parseFloat(walletData.balance).toFixed(2)} YHT` : "0 YHT"}
                  </span>
                </Button>
              )}

              {/* User Profile */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-user-menu">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuItem className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.username}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email || "No email"}
                        </p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={() => window.location.href = "/auth"}
                  className="flex items-center space-x-2"
                  data-testid="button-sign-in"
                >
                  <User className="w-4 h-4" />
                  <span>Sign In</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Wallet Modal */}
      <WalletModal 
        isOpen={showWalletModal} 
        onClose={() => setShowWalletModal(false)} 
      />
    </>
  );
}
