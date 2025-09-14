import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchTabsProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const searchCategories = [
  { id: "all", label: "All", icon: null },
  { id: "shopping", label: "Shopping", icon: "fas fa-shopping-cart" },
  { id: "companies", label: "Companies", icon: "fas fa-building" },
  { id: "news", label: "News", icon: "fas fa-newspaper" },
  { id: "saas", label: "SaaS", icon: "fas fa-cloud" },
  { id: "cloud", label: "Cloud", icon: "fas fa-server" },
  { id: "web3", label: "Web3.0", icon: "fas fa-cube" },
];

export default function SearchTabs({ activeCategory, onCategoryChange }: SearchTabsProps) {
  return (
    <div className="fixed top-16 left-0 right-0 bg-background border-b border-border z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8 py-3 overflow-x-auto">
          {searchCategories.map((category) => (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => onCategoryChange(category.id)}
              className={cn(
                "flex items-center space-x-2 pb-2 border-b-2 border-transparent whitespace-nowrap",
                activeCategory === category.id
                  ? "text-primary border-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${category.id}`}
            >
              {category.icon && <i className={`${category.icon} text-sm`}></i>}
              <span>{category.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
