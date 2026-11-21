import { useQuery } from '@tanstack/react-query';
import type {
  GetFeaturedProductsParams,
  ListCollectionsParams,
  ListProductsParams,
} from '@shared/storefront.types';
import {
  collectionsQuery,
  featuredProductsQuery,
  productQuery,
  productsQuery,
} from '@/lib/api';

export function useProducts(params?: ListProductsParams) {
  return useQuery(productsQuery(params));
}

export function useFeaturedProducts(params?: GetFeaturedProductsParams) {
  return useQuery(featuredProductsQuery(params));
}

export function useProduct(handle: string) {
  return useQuery(productQuery(handle));
}

export function useCollections(params?: ListCollectionsParams) {
  return useQuery(collectionsQuery(params));
}
