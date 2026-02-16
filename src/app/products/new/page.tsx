import { ProductForm } from '@/components/product-form';

export const dynamic = 'force-dynamic';

export default function NewProductPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 lg:px-8">
        <div className="animate-fade-in-up">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary">
            Add Product
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Enter a TikTok Shop URL to analyze the product
          </p>
        </div>
        <div className="mt-8">
          <ProductForm />
        </div>
    </main>
  );
}
