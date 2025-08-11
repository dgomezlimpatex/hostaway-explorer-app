import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin } from "lucide-react";

interface ProductSummary {
  product_id: string;
  product_name: string;
  quantity: number;
}

interface PropertyPackageCardProps {
  propertyCode: string;
  propertyName: string;
  totalItems: number;
  products: ProductSummary[];
}

export function PropertyPackageCard({ 
  propertyCode, 
  propertyName, 
  totalItems, 
  products 
}: PropertyPackageCardProps) {
  return (
    <Card className="border-l-4 border-l-primary/20 hover:border-l-primary/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {propertyCode}
          </CardTitle>
          <Badge variant="secondary" className="font-medium">
            {totalItems} items
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{propertyName}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-2">
            <Package className="h-3 w-3" />
            Contenido del paquete:
          </div>
          <div className="grid gap-1.5">
            {products.map((product, index) => (
              <div 
                key={`${product.product_id}-${index}`}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-foreground font-medium">
                  {product.product_name}
                </span>
                <Badge variant="outline" className="text-xs">
                  {product.quantity}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}