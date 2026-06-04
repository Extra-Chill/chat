import { useEffect, useMemo, useState } from 'react';

export interface ClientContextProvider {
	id: string;
	priority?: number;
	getContext: () => Record< string, unknown > | null;
}

export interface ClientContextProviderSnapshot {
	id: string;
	priority: number;
	context: Record< string, unknown >;
}

export interface ClientContextSnapshot {
	activeContext: Record< string, unknown > | null;
	providers: ClientContextProviderSnapshot[];
}

export interface ClientContextMetadataOptions {
	/** Metadata key used for the client context payload. Defaults to `client_context`. */
	metadataKey?: string;
	/** Include browser location and document title. Defaults to true. */
	includePage?: boolean;
	/** Include the highest-priority provider context. Defaults to true. */
	includeActiveContext?: boolean;
	/** Include every registered provider context. Defaults to true. */
	includeAvailableContexts?: boolean;
}

export interface ClientContextRegistry {
	registerProvider: ( provider: ClientContextProvider ) => () => void;
	unregisterProvider: ( id: string ) => void;
	subscribe: ( listener: () => void ) => () => void;
	notify: () => void;
	getSnapshot: () => ClientContextSnapshot;
}

declare global {
	interface Window {
		ecClientContextRegistry?: ClientContextRegistry;
	}
}

export function getOrCreateClientContextRegistry(): ClientContextRegistry {
	if ( typeof window === 'undefined' ) {
		return {
			registerProvider: () => () => undefined,
			unregisterProvider: () => undefined,
			subscribe: () => () => undefined,
			notify: () => undefined,
			getSnapshot: () => ( {
				activeContext: null,
				providers: [],
			} ),
		};
	}

	if ( window.ecClientContextRegistry ) {
		return window.ecClientContextRegistry;
	}

	const providers = new Map< string, ClientContextProvider >();
	const listeners = new Set< () => void >();

	const registry: ClientContextRegistry = {
		registerProvider( provider ) {
			providers.set( provider.id, provider );
			registry.notify();

			return () => {
				registry.unregisterProvider( provider.id );
			};
		},

		unregisterProvider( id ) {
			if ( providers.delete( id ) ) {
				registry.notify();
			}
		},

		subscribe( listener ) {
			listeners.add( listener );

			return () => {
				listeners.delete( listener );
			};
		},

		notify() {
			listeners.forEach( ( listener ) => listener() );
		},

		getSnapshot() {
			const providerSnapshots = Array.from( providers.values() )
				.map( ( provider ) => {
					const context = provider.getContext();
					if ( ! context ) {
						return null;
					}

					return {
						id: provider.id,
						priority: provider.priority ?? 0,
						context,
					};
				} )
				.filter(
					(
						provider
					): provider is ClientContextProviderSnapshot => Boolean( provider )
				)
				.sort( ( a, b ) => b.priority - a.priority );

			return {
				activeContext: providerSnapshots[ 0 ]?.context ?? null,
				providers: providerSnapshots,
			};
		},
	};

	window.ecClientContextRegistry = registry;

	return registry;
}

export function registerClientContextProvider( provider: ClientContextProvider ): () => void {
	return getOrCreateClientContextRegistry().registerProvider( provider );
}


export function getClientContextMetadata( options: ClientContextMetadataOptions = {} ): Record< string, unknown > {
	if ( typeof window === 'undefined' ) {
		return {};
	}

	const {
		metadataKey = 'client_context',
		includePage = true,
		includeActiveContext = true,
		includeAvailableContexts = true,
	} = options;
	const snapshot = getOrCreateClientContextRegistry().getSnapshot();
	const context: Record< string, unknown > = {};

	if ( includePage ) {
		Object.assign( context, {
			site: window.location.hostname,
			url: window.location.href,
			path: window.location.pathname,
			page_title: document.title,
		} );
	}

	if ( includeActiveContext ) {
		context.active_context = snapshot.activeContext;
	}

	if ( includeAvailableContexts ) {
		context.available_contexts = snapshot.providers.map( ( provider ) => ( {
			id: provider.id,
			priority: provider.priority,
			context: provider.context,
		} ) );
	}

	return {
		[ metadataKey ]: context,
	};
}

export function useClientContextMetadata( options: ClientContextMetadataOptions = {} ): Record< string, unknown > {
	const registry = useMemo( () => getOrCreateClientContextRegistry(), [] );
	const metadataKey = options.metadataKey ?? 'client_context';
	const includePage = options.includePage ?? true;
	const includeActiveContext = options.includeActiveContext ?? true;
	const includeAvailableContexts = options.includeAvailableContexts ?? true;
	const resolvedOptions = useMemo( () => ( {
		metadataKey,
		includePage,
		includeActiveContext,
		includeAvailableContexts,
	} ), [ metadataKey, includePage, includeActiveContext, includeAvailableContexts ] );
	const [ metadata, setMetadata ] = useState< Record< string, unknown > >( () =>
		getClientContextMetadata( resolvedOptions )
	);

	useEffect( () => {
		const sync = (): void => {
			setMetadata( getClientContextMetadata( resolvedOptions ) );
		};

		sync();

		return registry.subscribe( sync );
	}, [ registry, resolvedOptions ] );

	return metadata;
}
