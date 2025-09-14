import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Copy, Coins, TrendingUp, ArrowUpRight } from "lucide-react";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WalletData {
  balance: string;
  transactions: TokenTransaction[];
  contractAddress: string;
}

interface TokenTransaction {
  id: string;
  type: string;
  amount: string;
  reason: string;
  createdAt: string;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { toast } = useToast();
  
  const { data: walletData, isLoading } = useQuery<WalletData>({
    queryKey: ["/api/wallet/balance"],
    enabled: isOpen,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Contract address copied to clipboard",
    });
  };

  const formatAmount = (amount: string) => {
    return parseFloat(amount).toFixed(2);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "earned":
        return <TrendingUp className="w-4 h-4 text-web3" />;
      case "spent":
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case "staked":
        return <Coins className="w-4 h-4 text-blue-500" />;
      default:
        return <Coins className="w-4 h-4" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "earned":
        return "text-web3";
      case "spent":
        return "text-red-500";
      case "staked":
        return "text-blue-500";
      default:
        return "text-foreground";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="modal-wallet">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-web3" />
            <span>YHT Wallet</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Wallet Balance */}
          <Card className="bg-web3/10 border-web3/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">YHT Balance</span>
                <Coins className="w-5 h-5 text-web3" />
              </div>
              <div className="text-2xl font-bold text-web3" data-testid="text-wallet-balance">
                {isLoading ? "Loading..." : `${formatAmount(walletData?.balance || "0")} YHT`}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                ≈ ${(parseFloat(walletData?.balance || "0") * 0.1).toFixed(2)} USD
              </div>
            </CardContent>
          </Card>

          {/* Contract Address */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Contract Address</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(walletData?.contractAddress || "")}
                  data-testid="button-copy-contract"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="font-mono text-xs text-muted-foreground break-all" data-testid="text-contract-address">
                {walletData?.contractAddress || "0x3279eF4614f241a389114C77CdD28b70fcA9537a"}
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-3">Recent Transactions</h3>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading transactions...</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {walletData?.transactions?.length ? (
                    walletData.transactions.slice(0, 5).map((tx, index) => (
                      <div key={tx.id} className="flex justify-between items-center" data-testid={`transaction-${index}`}>
                        <div className="flex items-center space-x-2">
                          {getTransactionIcon(tx.type)}
                          <span className="text-muted-foreground">{tx.reason}</span>
                        </div>
                        <span className={`font-mono ${getTransactionColor(tx.type)}`}>
                          {tx.type === "spent" ? "-" : "+"}{formatAmount(tx.amount)} YHT
                        </span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Search Quality Bonus</span>
                        <span className="text-web3">+5 YHT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Daily Active Bonus</span>
                        <span className="text-web3">+10 YHT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Referral Bonus</span>
                        <span className="text-web3">+25 YHT</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button 
              className="flex-1 bg-web3 text-web3-foreground hover:bg-web3/90"
              data-testid="button-stake"
            >
              Stake YHT
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              data-testid="button-swap"
            >
              Swap
            </Button>
          </div>

          {/* Web3 Info */}
          <div className="text-center text-xs text-muted-foreground">
            <p>Connect your MetaMask wallet to manage YHT tokens</p>
            <p className="mt-1">
              <Badge variant="secondary" className="text-xs">
                Web3 Integrated
              </Badge>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
