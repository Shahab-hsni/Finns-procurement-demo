import { Search, Package, Utensils, Coffee, ChefHat, Beef, ShoppingCart, Play, Star, Users, ChevronRight, Video } from "lucide-react";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface Product {
  id: string;
  name: string;
  category: string;
  image: string;
}

interface ProductSidebarProps {
  theme?: 'dark' | 'light';
}

export function ProductSidebar({ theme = 'dark' }: ProductSidebarProps) {
  const isDark = theme === 'dark';
  
  const products: Product[] = [
    {
      id: '1',
      name: 'Fresh Vegetables',
      category: 'Produce',
      image: 'https://images.unsplash.com/photo-1751210769268-85d43ecfcdd8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBwcm9kdWNlfGVufDF8fHx8MTc2MTQyNDYwOHww&ixlib=rb-4.1.0&q=80&w=1080'
    },
    {
      id: '2',
      name: 'Premium Coffee Beans',
      category: 'Beverages',
      image: 'https://images.unsplash.com/photo-1736813133024-89928b251872?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBiZWFucyUyMHN1cHBsaWVzfGVufDF8fHx8MTc2MTQ2ODgzMHww&ixlib=rb-4.1.0&q=80&w=1080'
    },
    {
      id: '3',
      name: 'Kitchen Equipment',
      category: 'Equipment',
      image: 'https://images.unsplash.com/photo-1589109807644-924edf14ee09?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tZXJjaWFsJTIwa2l0Y2hlbiUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjEzOTgyMDd8MA&ixlib=rb-4.1.0&q=80&w=1080'
    },
    {
      id: '4',
      name: 'Bakery Ingredients',
      category: 'Baking',
      image: 'https://images.unsplash.com/photo-1761222191837-4448599c09fc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWtlcnklMjBpbmdyZWRpZW50cyUyMGZsb3VyfGVufDF8fHx8MTc2MTQ2ODgzMHww&ixlib=rb-4.1.0&q=80&w=1080'
    }
  ];

  const categories = [
    { name: 'Food & Beverage', icon: Utensils, color: isDark ? 'text-[#a3b085]' : 'text-[#87986a]' },
    { name: 'Coffee & Tea', icon: Coffee, color: isDark ? 'text-[#a3b085]' : 'text-[#87986a]' },
    { name: 'Fresh Produce', icon: Package, color: isDark ? 'text-[#a3b085]' : 'text-[#87986a]' },
    { name: 'Bakery', icon: ChefHat, color: isDark ? 'text-[#a3b085]' : 'text-[#87986a]' },
    { name: 'Proteins', icon: Beef, color: isDark ? 'text-[#a3b085]' : 'text-[#87986a]' },
    { name: 'Equipment', icon: ShoppingCart, color: isDark ? 'text-[#a3b085]' : 'text-[#87986a]' }
  ];

  const videos = [
    {
      id: '1',
      title: 'Farm Tour: Fresh Produce',
      thumbnail: 'https://images.unsplash.com/photo-1690934164598-99267828e900?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXJtZXJzJTIwbWFya2V0JTIwdmVnZXRhYmxlc3xlbnwxfHx8fDE3NjE2NjA5MDR8MA&ixlib=rb-4.1.0&q=80&w=1080',
      duration: '3:45'
    },
    {
      id: '2',
      title: 'Delivery Process Overview',
      thumbnail: 'https://images.unsplash.com/photo-1759808525145-504265bf1b71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9kdWNlJTIwZGVsaXZlcnl8ZW58MXx8fHwxNzYxNzMwMzk1fDA&ixlib=rb-4.1.0&q=80&w=1080',
      duration: '2:30'
    }
  ];

  const reviews = [
    {
      id: '1',
      vendor: 'Fresh Farm Supply',
      rating: 5,
      comment: 'Excellent quality produce, always fresh and on time',
      author: 'Sarah Chen'
    },
    {
      id: '2',
      vendor: 'Bean & Brew',
      rating: 4.5,
      comment: 'Great coffee selection and reliable service',
      author: 'Mike Johnson'
    },
    {
      id: '3',
      vendor: 'Kitchen Pro',
      rating: 5,
      comment: 'Best equipment supplier, very professional',
      author: 'Lisa Martinez'
    }
  ];

  const groupBuying = [
    {
      id: '1',
      name: 'Organic Vegetables Bundle',
      participants: 12,
      target: 20,
      discount: '15%',
      endsIn: '2 days'
    },
    {
      id: '2',
      name: 'Premium Coffee Beans',
      participants: 18,
      target: 25,
      discount: '20%',
      endsIn: '5 days'
    }
  ];

  const produceGallery = [
    'https://images.unsplash.com/photo-1751210769268-85d43ecfcdd8?w=300',
    'https://images.unsplash.com/photo-1715941872599-34c3edf7b96f?w=300',
    'https://images.unsplash.com/photo-1760727467302-0025e7fe9224?w=300',
    'https://images.unsplash.com/photo-1690934164598-99267828e900?w=300'
  ];

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white border-r border-gray-200'}`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <h2 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Discover</h2>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <Input
            placeholder="Search products..."
            className={`pl-10 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-gray-50'}`}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {/* Videos Section */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Featured Videos</h3>
            <ChevronRight className={`h-4 w-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>
          <div className="space-y-2">
            {videos.map((video) => (
              <div
                key={video.id}
                className={`rounded-lg overflow-hidden cursor-pointer group relative ${
                  isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'
                }`}
              >
                <div className="aspect-video w-full overflow-hidden relative">
                  <ImageWithFallback
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:bg-white transition-colors">
                      <Play className="h-5 w-5 text-gray-900 ml-1" fill="currentColor" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs">
                    {video.duration}
                  </div>
                </div>
                <div className="p-2">
                  <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {video.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Group Buying Section */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Group Buying</h3>
            <ChevronRight className={`h-4 w-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>
          <div className="space-y-3">
            {groupBuying.map((deal) => (
              <div
                key={deal.id}
                className={`p-3 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className={`text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {deal.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200'}>
                        {deal.discount} off
                      </Badge>
                    </div>
                  </div>
                  <Users className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
                </div>
                <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {deal.participants}/{deal.target} participants
                </div>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-[#87986a] rounded-full"
                    style={{ width: `${(deal.participants / deal.target) * 100}%` }}
                  />
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Ends in {deal.endsIn}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews Section */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Recent Reviews</h3>
            <ChevronRight className={`h-4 w-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className={`p-3 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}
              >
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < review.rating 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : isDark ? 'text-gray-600' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  "{review.comment}"
                </p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {review.author}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`}>
                    {review.vendor}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Produce Gallery */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Fresh Produce</h3>
            <ChevronRight className={`h-4 w-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {produceGallery.map((image, index) => (
              <div
                key={index}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              >
                <ImageWithFallback
                  src={image}
                  alt={`Produce ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`w-full mt-3 ${isDark ? 'text-[#a3b085] hover:text-[#bfc89f] hover:bg-[#87986a]/10' : 'text-[#87986a] hover:text-[#6b7a54]'}`}
          >
            View All Products
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Categories */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <h3 className={`mb-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Categories</h3>
          <div className="space-y-2">
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <button
                  key={index}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isDark 
                      ? 'hover:bg-gray-800 text-gray-300 hover:text-white' 
                      : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${category.color}`} />
                  <span className="text-sm">{category.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Popular Products */}
        <div className="p-4 space-y-3">
          <h3 className={`mb-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Popular Products</h3>
          {products.map((product) => (
            <div
              key={product.id}
              className={`rounded-lg overflow-hidden cursor-pointer transition-all ${
                isDark 
                  ? 'bg-[#2a2a2a] hover:bg-gray-800' 
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="aspect-video w-full overflow-hidden">
                <ImageWithFallback
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {product.name}
                </div>
                <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {product.category}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
