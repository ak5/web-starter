<script lang="ts">
	import type { PaginationMeta } from '@ak5/shared';
	import { page } from '$app/state';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';

	interface Props {
		pagination: PaginationMeta;
	}

	const { pagination }: Props = $props();

	function getPageUrl(pageNum: number): string {
		const url = new URL(page.url.href);
		url.searchParams.set('page', String(pageNum));
		return url.pathname + url.search;
	}

	// Helper to get pagination URLs (dynamic paths with query params)
	function resolvePageUrl(pageNum: number): string {
		return getPageUrl(pageNum);
	}

	function getVisiblePages(current: number, total: number): (number | 'ellipsis')[] {
		if (total <= 7) {
			return Array.from({ length: total }, (_, i) => i + 1);
		}

		const pages: (number | 'ellipsis')[] = [];

		// Always show first page
		pages.push(1);

		if (current > 3) {
			pages.push('ellipsis');
		}

		// Show pages around current
		const start = Math.max(2, current - 1);
		const end = Math.min(total - 1, current + 1);

		for (let i = start; i <= end; i++) {
			pages.push(i);
		}

		if (current < total - 2) {
			pages.push('ellipsis');
		}

		// Always show last page
		if (total > 1) {
			pages.push(total);
		}

		return pages;
	}

	const visiblePages = $derived(getVisiblePages(pagination.page, pagination.totalPages));
</script>

{#if pagination.totalPages > 1}
	<div class="mt-6 flex flex-col items-center gap-4">
		<div class="join">
			<!-- First page -->
			<a
				href={resolvePageUrl(1)}
				class="btn join-item btn-sm"
				class:btn-disabled={!pagination.hasPrev}
				aria-label="First page"
			>
				<ChevronsLeft class="h-4 w-4" />
			</a>

			<!-- Previous page -->
			<a
				href={resolvePageUrl(pagination.page - 1)}
				class="btn join-item btn-sm"
				class:btn-disabled={!pagination.hasPrev}
				aria-label="Previous page"
			>
				<ChevronLeft class="h-4 w-4" />
			</a>

			<!-- Page numbers -->
			{#each visiblePages as pageNum, i (i)}
				{#if pageNum === 'ellipsis'}
					<span class="btn btn-disabled join-item btn-sm">...</span>
				{:else}
					<a
						href={resolvePageUrl(pageNum)}
						class="btn join-item btn-sm"
						class:btn-active={pageNum === pagination.page}
					>
						{pageNum}
					</a>
				{/if}
			{/each}

			<!-- Next page -->
			<a
				href={resolvePageUrl(pagination.page + 1)}
				class="btn join-item btn-sm"
				class:btn-disabled={!pagination.hasNext}
				aria-label="Next page"
			>
				<ChevronRight class="h-4 w-4" />
			</a>

			<!-- Last page -->
			<a
				href={resolvePageUrl(pagination.totalPages)}
				class="btn join-item btn-sm"
				class:btn-disabled={!pagination.hasNext}
				aria-label="Last page"
			>
				<ChevronsRight class="h-4 w-4" />
			</a>
		</div>

		<p class="text-sm text-base-content/60">
			Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
		</p>
	</div>
{/if}
<!-- eslint-enable svelte/no-navigation-without-resolve -->
