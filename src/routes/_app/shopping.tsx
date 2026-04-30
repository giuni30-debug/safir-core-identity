import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ShoppingBag, Heart, Trash2, Plus, Minus,
  CreditCard, Sparkles, X, Star,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/shopping")({
  component: ShoppingPage,
  head: () => ({
    meta: [
      { title: "Shopping — Safir Private Life" },
      { name: "description", content: "Premium shopping experience inside Safir." },
    ],
  }),
});

type Product = {
  id: string;
  name: string;
  price: number;
  emoji: string;
  category: "tech" | "fashion" | "home" | "beauty";
  rating: number;
  featured?: boolean;
};

const PRODUCTS: Product[] = [
  { id: "p1", name: "Aurora Headphones", price: 249, emoji: "🎧", category: "tech",    rating: 4.9, featured: true },
  { id: "p2", name: "Neon Smartwatch",   price: 329, emoji: "⌚", category: "tech",    rating: 4.8, featured: true },
  { id: "p3", name: "Sapphire Sneakers", price: 189, emoji: "👟", category: "fashion", rating: 4.7 },
  { id: "p4", name: "Velvet Jacket",     price: 219, emoji: "🧥", category: "fashion", rating: 4.6 },
  { id: "p5", name: "Crystal Lamp",      price:  89, emoji: "💡", category: "home",    rating: 4.5, featured: true },
  { id: "p6", name: "Aroma Diffuser",    price:  59, emoji: "🕯️", category: "home",    rating: 4.4 },
  { id: "p7", name: "Glow Serum",        price:  45, emoji: "✨", category: "beauty",  rating: 4.9 },
  { id: "p8", name: "Silk Eye Mask",     price:  29, emoji: "👁️", category: "beauty",  rating: 4.6 },
  { id: "p9", name: "Wireless Charger",  price:  39, emoji: "🔋", category: "tech",    rating: 4.5 },
];

type Section = "browse" | "wishlist" | "cart";
type CartItem = { id: string; qty: number };

const LS_CART = "spl_shop_cart";
const LS_WISH = "spl_shop_wish";

function ShoppingPage() {
  const { t } = useApp();
  const navigate = useNavigate();

  const [section, setSection] = useState<Section>("browse");
  const [cat, setCat] = useState<"all" | Product["category"]>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wish, setWish] = useState<string[]>([]);
  const [preview, setPreview] = useState<Product | null>(null);
  const [bumpKey, setBumpKey] = useState(0);

  // Load
  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem(LS_CART) || "[]"));
      setWish(JSON.parse(localStorage.getItem(LS_WISH) || "[]"));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { localStorage.setItem(LS_CART, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem(LS_WISH, JSON.stringify(wish)); }, [wish]);

  const cartCount = cart.reduce((n, i) => n + i.qty, 0);
  const cartTotal = useMemo(
    () => cart.reduce((s, i) => {
      const p = PRODUCTS.find(x => x.id === i.id);
      return s + (p ? p.price * i.qty : 0);
    }, 0),
    [cart]
  );

  const addToCart = (p: Product) => {
    setCart(prev => {
      const found = prev.find(i => i.id === p.id);
      if (found) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, qty: 1 }];
    });
    setBumpKey(k => k + 1);
    toast.success(`${p.emoji} ${t("shopAdded")}`);
  };
  const incQty = (id: string) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i));
  const decQty = (id: string) =>
    setCart(prev => prev.flatMap(i => i.id === id ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]));
  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const toggleWish = (id: string) => {
    setWish(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = PRODUCTS.filter(p => cat === "all" || p.category === cat);
  const featured = PRODUCTS.filter(p => p.featured);
  const wishProducts = PRODUCTS.filter(p => wish.includes(p.id));

  const cats: { key: typeof cat; label: string }[] = [
    { key: "all",     label: t("shopAll") },
    { key: "tech",    label: "Tech" },
    { key: "fashion", label: "Fashion" },
    { key: "home",    label: "Home" },
    { key: "beauty",  label: "Beauty" },
  ];

  const checkout = () => {
    if (cart.length === 0) return;
    toast.success(t("shopPaid"));
    setCart([]);
    setSection("browse");
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label={t("back")}
          className="press-glow grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-neon-title flex-1 text-center text-base">
          {t("shopping")}
        </h1>
        <button
          type="button"
          onClick={() => setSection("cart")}
          aria-label={t("shopCart")}
          className="press-glow relative grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/40"
          style={{
            color: "var(--theme-accent)",
            boxShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 40%, transparent)",
          }}
        >
          <ShoppingBag className="h-5 w-5" />
          {cartCount > 0 && (
            <span
              key={bumpKey}
              className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-[10px] font-bold"
              style={{
                background: "var(--theme-accent)",
                color: "var(--primary-foreground)",
                boxShadow: "0 0 10px var(--theme-glow)",
                animation: "scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </header>

      {/* Section tabs */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {([
          { k: "browse",   label: t("shopFeatured"),  icon: Sparkles },
          { k: "wishlist", label: t("shopWishlist"),  icon: Heart },
          { k: "cart",     label: t("shopCart"),      icon: ShoppingBag },
        ] as const).map(({ k, label, icon: Icon }) => {
          const active = section === k;
          return (
            <button
              key={k}
              onClick={() => setSection(k)}
              className="press-glow flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold tracking-wide"
              style={{
                borderColor: active
                  ? "color-mix(in oklab, var(--theme-accent) 75%, transparent)"
                  : "var(--glass-border)",
                background: active
                  ? "color-mix(in oklab, var(--theme-accent) 14%, transparent)"
                  : "oklch(1 0 0 / 4%)",
                boxShadow: active
                  ? "0 0 18px color-mix(in oklab, var(--theme-accent) 40%, transparent)"
                  : "none",
                color: "#fff",
                textShadow: active
                  ? "0 0 10px var(--theme-accent)"
                  : "0 1px 0 oklch(1 0 0 / 14%)",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-6">
        {section === "browse" && (
          <BrowseSection
            cats={cats}
            cat={cat}
            setCat={setCat}
            featured={featured}
            products={filtered}
            wish={wish}
            toggleWish={toggleWish}
            addToCart={addToCart}
            openPreview={setPreview}
            t={t}
          />
        )}

        {section === "wishlist" && (
          <WishSection
            products={wishProducts}
            toggleWish={toggleWish}
            addToCart={addToCart}
            openPreview={setPreview}
            t={t}
          />
        )}

        {section === "cart" && (
          <CartSection
            cart={cart}
            total={cartTotal}
            inc={incQty}
            dec={decQty}
            remove={removeFromCart}
            checkout={checkout}
            t={t}
          />
        )}
      </div>

      {/* Product preview modal */}
      {preview && (
        <ProductPreview
          product={preview}
          onClose={() => setPreview(null)}
          onAdd={() => { addToCart(preview); setPreview(null); }}
          inWish={wish.includes(preview.id)}
          toggleWish={() => toggleWish(preview.id)}
          t={t}
        />
      )}
    </div>
  );
}

/* ───────────── Browse ───────────── */
function BrowseSection({
  cats, cat, setCat, featured, products, wish, toggleWish, addToCart, openPreview, t,
}: {
  cats: { key: "all" | Product["category"]; label: string }[];
  cat: "all" | Product["category"];
  setCat: (c: "all" | Product["category"]) => void;
  featured: Product[];
  products: Product[];
  wish: string[];
  toggleWish: (id: string) => void;
  addToCart: (p: Product) => void;
  openPreview: (p: Product) => void;
  t: (k: any) => string;
}) {
  return (
    <div className="space-y-5">
      <p className="text-soft text-center text-xs tracking-wide">{t("shopBrowse")}</p>

      {/* Featured rail */}
      {featured.length > 0 && (
        <div>
          <h3 className="text-premium mb-2 text-xs uppercase tracking-[0.2em]">
            ✨ {t("shopFeatured")}
          </h3>
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
            {featured.map((p) => (
              <button
                key={p.id}
                onClick={() => openPreview(p)}
                className="glass-card glass-card-hover tile-press snap-start flex w-44 shrink-0 flex-col items-start gap-2 p-4 text-left"
                style={{ borderRadius: 20 }}
              >
                <div
                  className="grid h-20 w-full place-items-center rounded-xl text-5xl"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 22%, transparent), oklch(1 0 0 / 3%))",
                    boxShadow: "inset 0 0 18px color-mix(in oklab, var(--theme-accent) 18%, transparent)",
                  }}
                >
                  <span style={{ filter: "drop-shadow(0 0 10px color-mix(in oklab, var(--theme-accent) 60%, transparent))" }}>
                    {p.emoji}
                  </span>
                </div>
                <span className="text-premium text-sm font-semibold leading-tight">{p.name}</span>
                <div className="flex w-full items-center justify-between">
                  <span className="text-neon-title text-base">€{p.price}</span>
                  <RatingStars rating={p.rating} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {cats.map((c) => {
          const active = c.key === cat;
          return (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className="press-glow shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: active ? "var(--theme-accent)" : "var(--glass-border)",
                background: active
                  ? "color-mix(in oklab, var(--theme-accent) 18%, transparent)"
                  : "oklch(1 0 0 / 4%)",
                color: "#fff",
                textShadow: active ? "0 0 10px var(--theme-accent)" : "none",
                boxShadow: active
                  ? "0 0 14px color-mix(in oklab, var(--theme-accent) 40%, transparent)"
                  : "none",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            inWish={wish.includes(p.id)}
            toggleWish={() => toggleWish(p.id)}
            onAdd={() => addToCart(p)}
            onOpen={() => openPreview(p)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

/* ───────────── Product card ───────────── */
function ProductCard({ p, inWish, toggleWish, onAdd, onOpen, t }: {
  p: Product; inWish: boolean; toggleWish: () => void; onAdd: () => void; onOpen: () => void;
  t: (k: any) => string;
}) {
  return (
    <div
      className="glass-card glass-card-hover relative flex flex-col gap-2 p-3"
      style={{ borderRadius: 20 }}
    >
      <button
        type="button"
        onClick={toggleWish}
        aria-label="wishlist"
        className="press-glow absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full"
        style={{
          background: "oklch(0 0 0 / 35%)",
          backdropFilter: "blur(8px)",
          color: inWish ? "#ff5e8a" : "#fff",
          boxShadow: inWish ? "0 0 12px #ff5e8a" : "none",
        }}
      >
        <Heart className="h-4 w-4" fill={inWish ? "currentColor" : "none"} />
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="grid h-24 w-full place-items-center rounded-xl text-5xl"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 18%, transparent), oklch(1 0 0 / 3%))",
          boxShadow: "inset 0 0 16px color-mix(in oklab, var(--theme-accent) 14%, transparent)",
        }}
      >
        <span style={{ filter: "drop-shadow(0 0 10px color-mix(in oklab, var(--theme-accent) 55%, transparent))" }}>
          {p.emoji}
        </span>
      </button>

      <div className="flex flex-col gap-0.5">
        <span className="text-premium text-sm font-semibold leading-tight">{p.name}</span>
        <div className="flex items-center justify-between">
          <span className="text-neon-title text-base">€{p.price}</span>
          <RatingStars rating={p.rating} />
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="press-glow mt-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold tracking-wide"
        style={{
          background: "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 60%, #000))",
          color: "var(--primary-foreground)",
          boxShadow: "0 0 16px color-mix(in oklab, var(--theme-accent) 50%, transparent)",
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        {t("shopAddToCart")}
      </button>
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-white"
          style={{ textShadow: "0 0 8px color-mix(in oklab, var(--theme-accent) 50%, transparent)" }}>
      <Star className="h-3 w-3" fill="currentColor"
            style={{ color: "var(--theme-accent)", filter: "drop-shadow(0 0 4px var(--theme-accent))" }} />
      {rating.toFixed(1)}
    </span>
  );
}

/* ───────────── Wishlist ───────────── */
function WishSection({ products, toggleWish, addToCart, openPreview, t }: {
  products: Product[]; toggleWish: (id: string) => void; addToCart: (p: Product) => void;
  openPreview: (p: Product) => void; t: (k: any) => string;
}) {
  if (products.length === 0) {
    return (
      <EmptyState icon={<Heart className="h-10 w-10" />} label={t("shopEmptyWishlist")} />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          p={p}
          inWish
          toggleWish={() => toggleWish(p.id)}
          onAdd={() => addToCart(p)}
          onOpen={() => openPreview(p)}
          t={t}
        />
      ))}
    </div>
  );
}

/* ───────────── Cart ───────────── */
function CartSection({ cart, total, inc, dec, remove, checkout, t }: {
  cart: CartItem[]; total: number;
  inc: (id: string) => void; dec: (id: string) => void; remove: (id: string) => void;
  checkout: () => void; t: (k: any) => string;
}) {
  if (cart.length === 0) {
    return <EmptyState icon={<ShoppingBag className="h-10 w-10" />} label={t("shopEmptyCart")} />;
  }
  return (
    <div className="flex flex-col gap-3">
      {cart.map((i) => {
        const p = PRODUCTS.find(x => x.id === i.id);
        if (!p) return null;
        return (
          <div key={i.id}
               className="glass-card flex items-center gap-3 p-3"
               style={{ borderRadius: 18 }}>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-3xl"
                 style={{
                   background: "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 20%, transparent), oklch(1 0 0 / 3%))",
                 }}>
              <span style={{ filter: "drop-shadow(0 0 8px color-mix(in oklab, var(--theme-accent) 50%, transparent))" }}>
                {p.emoji}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-premium truncate text-sm font-semibold">{p.name}</div>
              <div className="text-neon-title text-sm">€{(p.price * i.qty).toFixed(2)}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => dec(i.id)} aria-label="-"
                className="press-glow grid h-7 w-7 place-items-center rounded-full border"
                style={{ borderColor: "var(--glass-border)", color: "#fff" }}>
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-5 text-center text-sm font-bold">{i.qty}</span>
              <button onClick={() => inc(i.id)} aria-label="+"
                className="press-glow grid h-7 w-7 place-items-center rounded-full"
                style={{
                  background: "var(--theme-accent)",
                  color: "var(--primary-foreground)",
                  boxShadow: "0 0 10px var(--theme-glow)",
                }}>
                <Plus className="h-3 w-3" />
              </button>
              <button onClick={() => remove(i.id)} aria-label="remove"
                className="press-glow ml-1 grid h-7 w-7 place-items-center rounded-full border"
                style={{ borderColor: "color-mix(in oklab, #ff4d6d 50%, transparent)", color: "#ff8aa3" }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Checkout summary */}
      <div className="glass-card mt-2 flex flex-col gap-3 p-4" style={{ borderRadius: 22 }}>
        <div className="flex items-center justify-between">
          <span className="text-premium text-sm tracking-wide">{t("shopTotal")}</span>
          <span className="text-neon-title text-xl">€{total.toFixed(2)}</span>
        </div>
        <button
          onClick={checkout}
          className="press-glow flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold tracking-wide"
          style={{
            background: "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 55%, #000))",
            color: "var(--primary-foreground)",
            boxShadow:
              "0 0 22px color-mix(in oklab, var(--theme-accent) 55%, transparent), inset 0 1px 0 oklch(1 0 0 / 25%)",
          }}
        >
          <CreditCard className="h-4 w-4" />
          {t("shopPay")}
        </button>
      </div>
    </div>
  );
}

/* ───────────── Preview modal ───────────── */
function ProductPreview({ product, onClose, onAdd, inWish, toggleWish, t }: {
  product: Product; onClose: () => void; onAdd: () => void;
  inWish: boolean; toggleWish: () => void; t: (k: any) => string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{
        background: "oklch(0 0 0 / 65%)",
        backdropFilter: "blur(14px)",
        animation: "gift-fade 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        className="glass-card relative w-full max-w-sm p-6"
        style={{ borderRadius: 28, animation: "scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="close"
          className="press-glow absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full"
          style={{ background: "oklch(0 0 0 / 35%)", color: "#fff" }}
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className="mx-auto grid h-40 w-40 place-items-center rounded-3xl text-8xl"
          style={{
            background: "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 28%, transparent), oklch(1 0 0 / 4%))",
            boxShadow: "inset 0 0 30px color-mix(in oklab, var(--theme-accent) 25%, transparent), 0 0 30px color-mix(in oklab, var(--theme-accent) 35%, transparent)",
            animation: "logo-breath 3s ease-in-out infinite",
          }}
        >
          <span style={{ filter: "drop-shadow(0 0 14px color-mix(in oklab, var(--theme-accent) 70%, transparent))" }}>
            {product.emoji}
          </span>
        </div>

        <h2 className="text-neon-title mt-4 text-center text-lg">{product.name}</h2>
        <div className="mt-1 flex items-center justify-center gap-3">
          <span className="text-neon-title text-2xl">€{product.price}</span>
          <RatingStars rating={product.rating} />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={toggleWish}
            className="press-glow grid h-11 w-11 place-items-center rounded-full border"
            style={{
              borderColor: inWish ? "#ff5e8a" : "var(--glass-border)",
              color: inWish ? "#ff5e8a" : "#fff",
              boxShadow: inWish ? "0 0 14px #ff5e8a" : "none",
            }}
          >
            <Heart className="h-5 w-5" fill={inWish ? "currentColor" : "none"} />
          </button>
          <button
            onClick={onAdd}
            className="press-glow flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-bold tracking-wide"
            style={{
              background: "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 55%, #000))",
              color: "var(--primary-foreground)",
              boxShadow: "0 0 18px color-mix(in oklab, var(--theme-accent) 55%, transparent)",
            }}
          >
            <Plus className="h-4 w-4" />
            {t("shopAddToCart")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Empty state ───────────── */
function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <div
        className="grid h-20 w-20 place-items-center rounded-3xl"
        style={{
          background: "color-mix(in oklab, var(--theme-accent) 12%, transparent)",
          color: "var(--theme-accent)",
          boxShadow: "0 0 20px color-mix(in oklab, var(--theme-accent) 35%, transparent)",
        }}
      >
        {icon}
      </div>
      <p className="text-soft text-sm">{label}</p>
    </div>
  );
}
