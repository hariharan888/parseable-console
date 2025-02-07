import { Log } from '@/@types/parseable/api/query';
import { LogStreamData, LogStreamSchemaData } from '@/@types/parseable/api/stream';
import { FIXED_DURATIONS, FixedDuration } from '@/constants/timeConstants';
import initContext from '@/utils/initContext';
import dayjs from 'dayjs';
import { addOrRemoveElement } from '@/utils';
import { getPageSlice, makeHeadersFromSchema, makeHeadersfromData } from '../utils';
import _ from 'lodash';
import { sanitizeCSVData } from '@/utils/exportHelpers';

export const DEFAULT_FIXED_DURATIONS = FIXED_DURATIONS[0];
export const LOG_QUERY_LIMITS = [30, 50, 100, 150, 200];
export const LOAD_LIMIT = 9000;

type ReducerOutput = Partial<LogsStore>;

export type ConfigType = {
	column: string;
	operator: string;
	value: string | number;
	repeats: number;
	ignore_case?: boolean;
};

export interface RuleConfig {
	type: string;
	config: ConfigType;
}

export interface Target {
	type: string;
	endpoint: string;
	username?: string;
	password?: string;
	headers?: Record<string, string>;
	skip_tls_check: boolean;
	repeat: {
		interval: string;
		times: number;
	};
}

export interface TransformedTarget {
	type: string;
	endpoint: string;
	username?: string;
	password?: string;
	headers?: Record<string, string>[];
	skip_tls_check: boolean;
	repeat: {
		interval: string;
		times: number;
	};
}

export interface Alert {
	name: string;
	message: string;
	rule: RuleConfig;
	targets: Target[];
}

export interface TransformedAlert {
	name: string;
	message: string;
	rule: RuleConfig;
	targets: TransformedTarget[];
}

export interface AlertsResponse {
	version: string;
	alerts: Alert[];
}

export type TransformedAlerts = {
	version: string;
	alerts: TransformedAlert[];
};

type TimeRange = {
	startTime: Date;
	endTime: Date;
	type: 'fixed' | 'custom';
	label: string;
	interval: number | null;
};

enum SortOrder {
	ASCENDING = 1,
	DESCENDING = -1,
}

type QuickFilters = {
	search: string;
	filters: Record<string, string[]>;
	sort: {
		key: string;
		order: SortOrder;
	};
};

type LiveTailStatus = 'streaming' | 'stopped' | 'abort' | 'fetch' | '';

type LiveTailConfig = {
	liveTailStatus: LiveTailStatus;
	liveTailSchemaData: LogStreamData;
	liveTailSearchValue: string;
	liveTailSearchField: string;
	showLiveTail: boolean;
};

const getDefaultTimeRange = (duration: FixedDuration = DEFAULT_FIXED_DURATIONS) => {
	const now = dayjs().startOf('minute');
	const { milliseconds, name } = duration;
	return {
		startTime: now.subtract(milliseconds, 'milliseconds').toDate(),
		endTime: now.toDate(),
		type: 'fixed' as 'fixed',
		label: name,
		interval: milliseconds,
	};
};

const defaultQuickFilters = {
	search: '',
	filters: {},
	sort: {
		key: 'p_timestamp',
		order: SortOrder.DESCENDING,
	},
};

const defaultLiveTailConfig = {
	liveTailStatus: '' as '',
	liveTailSchemaData: [],
	liveTailSearchValue: '',
	liveTailSearchField: '',
	showLiveTail: false,
	grpcPort: null,
};

const defaultCustQuerySearchState = {
	showQueryBuilder: false,
	isQuerySearchActive: false,
	custSearchQuery: '',
	viewMode: 'filters',
	activeMode: null,
};

type LogQueryData = {
	rawData: Log[];
	filteredData: Log[];
};

type CustQuerySearchState = {
	showQueryBuilder: boolean;
	isQuerySearchActive: boolean;
	custSearchQuery: string;
	viewMode: string;
	activeMode: null | 'filters' | 'sql';
};

type LogsStore = {
	timeRange: TimeRange;
	quickFilters: QuickFilters;
	liveTailConfig: LiveTailConfig;
	refreshInterval: number | null;
	selectedLog: Log | null;
	custQuerySearchState: CustQuerySearchState;

	modalOpts: {
		deleteModalOpen: boolean;
		alertsModalOpen: boolean;
		retentionModalOpen: boolean;
		queryBuilderModalOpen: boolean;
	};

	tableOpts: {
		disabledColumns: string[];
		pinnedColumns: string[];
		pageData: Log[];
		totalPages: number;
		totalCount: number;
		displayedCount: number;
		currentPage: number;
		perPage: number;
		currentOffset: number;
		headers: string[];
		sortKey: string;
		sortOrder: 'asc' | 'desc';
		filters: Record<string, string[]>;
	};

	data: LogQueryData & {
		schema: LogStreamSchemaData | null;
	};

	retention: {
		action: 'delete';
		duration: number;
		description: string;
	};

	alerts: TransformedAlerts;
};

type LogsStoreReducers = {
	setTimeRange: (store: LogsStore, payload: Partial<TimeRange>) => ReducerOutput;
	// resetTimeRange: (store: LogsStore) => ReducerOutput;
	deleteFilterItem: (store: LogsStore, key: string) => ReducerOutput;
	addFilterItem: (store: LogsStore, key: string, value: string[]) => ReducerOutput;
	setLiveTailStatus: (store: LogsStore, liveTailStatus: LiveTailStatus) => ReducerOutput;
	resetLiveTailSearchState: (store: LogsStore) => ReducerOutput;
	setLiveTailSchema: (store: LogsStore, liveTailSchemaData: LogStreamData) => ReducerOutput;
	setRefreshInterval: (store: LogsStore, interval: number | null) => ReducerOutput;
	resetQuickFilters: (store: LogsStore) => ReducerOutput;
	streamChangeCleanup: (store: LogsStore) => ReducerOutput;
	toggleQueryBuilder: (store: LogsStore, val?: boolean) => ReducerOutput;
	resetCustQuerySearchState: (store: LogsStore) => ReducerOutput;
	setCustQuerySearchState: (store: LogsStore, payload: Partial<CustQuerySearchState>) => ReducerOutput;
	toggleCustQuerySearchViewMode: (store: LogsStore, targetMode: 'sql' | 'filters') => ReducerOutput;
	toggleDeleteModal: (store: LogsStore, val?: boolean) => ReducerOutput;
	toggleAlertsModal: (store: LogsStore, val?: boolean) => ReducerOutput;
	toggleRetentionModal: (store: LogsStore, val?: boolean) => ReducerOutput;
	toggleLiveTail: (store: LogsStore) => ReducerOutput;
	setSelectedLog: (store: LogsStore, log: Log | null) => ReducerOutput;

	// table opts reducers
	toggleDisabledColumns: (store: LogsStore, columnName: string) => ReducerOutput;
	togglePinnedColumns: (store: LogsStore, columnName: string) => ReducerOutput;
	setCurrentOffset: (store: LogsStore, offset: number) => ReducerOutput;
	setPerPage: (store: LogsStore, perPage: number) => ReducerOutput;
	setCurrentPage: (store: LogsStore, page: number) => ReducerOutput;
	setTotalCount: (store: LogsStore, totalCount: number) => ReducerOutput;
	setPageAndPageData: (store: LogsStore, pageNo: number, perPage?: number) => ReducerOutput;
	setAndSortData: (store: LogsStore, sortKey: string, sortOrder: 'asc' | 'desc') => ReducerOutput;
	setAndFilterData: (store: LogsStore, filterKey: string, filterValues: string[], remove?: boolean) => ReducerOutput;
	getCleanStoreForRefetch: (store: LogsStore) => ReducerOutput;

	// data reducers
	setData: (store: LogsStore, data: Log[]) => ReducerOutput;
	setStreamSchema: (store: LogsStore, schema: LogStreamSchemaData) => ReducerOutput;
	applyCustomQuery: (store: LogsStore, query: string, mode: 'filters' | 'sql') => ReducerOutput;
	getUniqueValues: (data: Log[], key: string) => string[];
	makeExportData: (data: Log[], headers: string[], type: string) => Log[];
	setRetention: (store: LogsStore, retention: { description: string; duration: string }) => ReducerOutput;
	setAlerts: (store: LogsStore, alertsResponse: AlertsResponse) => ReducerOutput;
	transformAlerts: (alerts: TransformedAlert[]) => Alert[];

	setCleanStoreForStreamChange: (store: LogsStore) => ReducerOutput;
};

const initialState: LogsStore = {
	timeRange: getDefaultTimeRange(),
	quickFilters: defaultQuickFilters,
	liveTailConfig: defaultLiveTailConfig,
	refreshInterval: null,
	selectedLog: null,
	custQuerySearchState: defaultCustQuerySearchState,

	modalOpts: {
		deleteModalOpen: false,
		alertsModalOpen: false,
		retentionModalOpen: false,
		queryBuilderModalOpen: false,
	},

	tableOpts: {
		disabledColumns: [],
		pinnedColumns: [],
		pageData: [],
		perPage: 30,
		totalCount: 0,
		displayedCount: 0,
		totalPages: 0,
		currentPage: 0,
		currentOffset: 0,
		headers: [],
		sortKey: 'p_timestamp',
		sortOrder: 'desc',
		filters: {},
	},

	// data
	data: {
		rawData: [],
		filteredData: [],
		schema: null,
	},

	retention: {
		action: 'delete',
		description: '',
		duration: 0,
	},

	alerts: {
		version: '',
		alerts: [],
	},
	// if adding new fields, verify streamChangeCleanup
};

const { Provider: LogsProvider, useStore: useLogsStore } = initContext(initialState);

const getTotalPages = (data: Log[], perPage: number) => {
	return _.isEmpty(data) ? 0 : _.size(data) / perPage;
};

const setSelectedLog = (_store: LogsStore, log: Log | null) => {
	return { selectedLog: log };
};

// reducers
const setTimeRange = (store: LogsStore, payload: Partial<TimeRange>) => {
	const { label } = payload;
	const duration = _.find(FIXED_DURATIONS, (duration) => duration.name === label);
	const interval = duration?.milliseconds || null;
	return { ...getCleanStoreForRefetch(store), timeRange: { ...store.timeRange, ...payload, interval } };
};

// const resetTimeRange = (store: LogsStore) => {
// 	const now = dayjs();
// 	const timeDiff = store.timeRange.endTime.getTime() - store.timeRange.startTime.getTime();
// 	const startTime = now.subtract(timeDiff).toDate();
// 	const endTime = now.toDate();
// 	return store.timeRange.type === 'custom' ? store : { timeRange: { ...store.timeRange, startTime, endTime } };
// };

const deleteFilterItem = (store: LogsStore, key: string) => {
	const filters = store.quickFilters.filters;
	const updatedFilters = (({ [key]: _, ...filters }) => filters)(filters);
	return { quickFilters: { ...store.quickFilters, filters: updatedFilters } };
};

const addFilterItem = (store: LogsStore, key: string, value: string[]) => {
	const filters = store.quickFilters.filters;
	const updatedFilters = { ...filters, [key]: value };
	return { quickFilters: { ...store.quickFilters, filters: updatedFilters } };
};

const resetQuickFilters = (_store: LogsStore) => {
	return { quickFilters: defaultQuickFilters };
};

const setLiveTailStatus = (store: LogsStore, liveTailStatus: LiveTailStatus) => {
	const { liveTailConfig } = store;
	return { liveTailConfig: { ...liveTailConfig, liveTailStatus } };
};

const resetLiveTailSearchState = (store: LogsStore) => {
	return { liveTailConfig: { ...store.liveTailConfig, liveTailSearchValue: '', liveTailSearchField: '' } };
};

const setLiveTailSchema = (store: LogsStore, liveTailSchemaData: LogStreamData) => {
	return { liveTailConfig: { ...store.liveTailConfig, liveTailSchemaData } };
};

const toggleLiveTail = (store: LogsStore) => {
	return { liveTailConfig: { ...defaultLiveTailConfig, showLiveTail: !store.liveTailConfig.showLiveTail } };
};

const setRefreshInterval = (_store: LogsStore, interval: number | null) => {
	return { refreshInterval: interval };
};

const streamChangeCleanup = (_store: LogsStore) => {
	return { ...initialState };
};

const toggleQueryBuilder = (store: LogsStore, val?: boolean) => {
	const { custQuerySearchState } = store;
	return {
		custQuerySearchState: {
			...custQuerySearchState,
			showQueryBuilder: _.isBoolean(val) ? val : !custQuerySearchState.showQueryBuilder,
		},
	};
};

const resetCustQuerySearchState = (store: LogsStore) => {
	const { custQuerySearchState } = store;
	return {
		custQuerySearchState: { ...defaultCustQuerySearchState, viewMode: custQuerySearchState.viewMode },
		...getCleanStoreForRefetch(store),
	};
};

const setCustQuerySearchState = (store: LogsStore, payload: Partial<CustQuerySearchState>) => {
	const { custQuerySearchState } = store;
	return {
		custQuerySearchState: { ...custQuerySearchState, ...payload, isQuerySearchActive: true, showQueryBuilder: false },
	};
};

const toggleCustQuerySearchViewMode = (store: LogsStore, targetMode: 'filters' | 'sql') => {
	const { custQuerySearchState } = store;

	return {
		custQuerySearchState: { ...custQuerySearchState, viewMode: targetMode },
	};
};

const toggleDeleteModal = (store: LogsStore, val?: boolean) => {
	const { modalOpts } = store;
	return { modalOpts: { ...modalOpts, deleteModalOpen: _.isBoolean(val) ? val : !modalOpts.deleteModalOpen } };
};

const toggleRetentionModal = (store: LogsStore, val?: boolean) => {
	const { modalOpts } = store;
	return { modalOpts: { ...modalOpts, retentionModalOpen: _.isBoolean(val) ? val : !modalOpts.retentionModalOpen } };
};

const toggleAlertsModal = (store: LogsStore, val?: boolean) => {
	const { modalOpts } = store;
	return { modalOpts: { ...modalOpts, alertsModalOpen: _.isBoolean(val) ? val : !modalOpts.alertsModalOpen } };
};

const toggleDisabledColumns = (store: LogsStore, columnName: string) => {
	const { tableOpts } = store;
	return {
		tableOpts: {
			...tableOpts,
			disabledColumns: addOrRemoveElement(tableOpts.disabledColumns, columnName),
		},
	};
};

const togglePinnedColumns = (store: LogsStore, columnName: string) => {
	const { tableOpts } = store;
	return {
		tableOpts: {
			...tableOpts,
			pinnedColumns: addOrRemoveElement(tableOpts.pinnedColumns, columnName),
		},
	};
};

const filterAndSortData = (
	opts: { sortOrder: 'asc' | 'desc'; sortKey: string; filters: Record<string, string[]> },
	data: Log[],
) => {
	const { sortOrder, sortKey, filters } = opts;
	const filteredData = _.isEmpty(filters)
		? data
		: (_.reduce(
				data,
				(acc: Log[], d: Log) => {
					const doesMatch = _.some(filters, (value, key) => _.includes(value, _.toString(d[key])));
					return doesMatch ? [...acc, d] : acc;
				},
				[],
		  ) as Log[]);
	const sortedData = _.orderBy(filteredData, [sortKey], [sortOrder]);
	return sortedData;
};

const setData = (store: LogsStore, data: Log[]) => {
	const { data: existingData, custQuerySearchState, tableOpts } = store;
	const currentPage = tableOpts.currentPage === 0 ? 1 : tableOpts.currentPage;
	const filteredData = filterAndSortData(tableOpts, data);
	const newPageSlice = filteredData && getPageSlice(currentPage, tableOpts.perPage, filteredData);

	// only if pageoffset is 1
	const newHeaders =
		filteredData && existingData.schema && custQuerySearchState.isQuerySearchActive
			? makeHeadersfromData(filteredData)
			: makeHeadersFromSchema(existingData.schema);

	return {
		tableOpts: {
			...store.tableOpts,
			...(newPageSlice ? { pageData: newPageSlice } : {}),
			...(newHeaders ? { headers: newHeaders } : {}),
			currentPage,
			totalPages: getTotalPages(filteredData, tableOpts.perPage),
		},
		data: { ...existingData, rawData: data, filteredData: data },
	};
};

const setStreamSchema = (store: LogsStore, schema: LogStreamSchemaData) => {
	return {
		data: {
			...store.data,
			schema,
		},
	};
};

const setPerPage = (store: LogsStore, perPage: number) => {
	return {
		tableOpts: {
			...store.tableOpts,
			perPage,
		},
	};
};

const setCurrentPage = (store: LogsStore, currentPage: number) => {
	return {
		tableOpts: {
			...store.tableOpts,
			currentPage,
		},
	};
};

const setCurrentOffset = (store: LogsStore, currentOffset: number) => {
	return {
		tableOpts: {
			...store.tableOpts,
			currentOffset,
		},
	};
};

const setTotalCount = (store: LogsStore, totalCount: number) => {
	return {
		tableOpts: {
			...store.tableOpts,
			totalCount,
		},
	};
};

const setPageAndPageData = (store: LogsStore, pageNo: number, perPage?: number) => {
	const {
		data: { filteredData },
		tableOpts,
	} = store;
	const updatedPerPage = perPage || tableOpts.perPage;
	const newPageSlice = filteredData && getPageSlice(pageNo, updatedPerPage, filteredData);

	return {
		tableOpts: {
			...store.tableOpts,
			pageData: newPageSlice,
			currentPage: pageNo,
			totalPages: getTotalPages(filteredData, updatedPerPage),
			perPage: updatedPerPage,
		},
	};
};

const getCleanStoreForRefetch = (store: LogsStore) => {
	const { tableOpts, data, timeRange } = store;
	const { interval, type } = timeRange;

	const duration = _.find(FIXED_DURATIONS, (duration) => duration.name === timeRange.label);
	const updatedTimeRange = interval && type === 'fixed' ? { timeRange: getDefaultTimeRange(duration) } : {};
	return {
		tableOpts: {
			...tableOpts,
			pageData: [],
			totalCount: 0,
			displayedCount: 0,
			currentPage: 0,
			currentOffset: 0,
			headers: [],
			totalPages: 0,
		},
		data: {
			...data,
			filteredData: [],
			rawData: [],
		},
		...updatedTimeRange,
	};
};

const setCleanStoreForStreamChange = (store: LogsStore) => {
	const { tableOpts, timeRange, alerts } = store;
	const { interval, type } = timeRange;
	const duration = _.find(FIXED_DURATIONS, (duration) => duration.name === timeRange.label);
	const updatedTimeRange = interval && type === 'fixed' ? { timeRange: getDefaultTimeRange(duration) } : {};
	return {
		...initialState,
		tableOpts: {
			...tableOpts,
			pageData: [],
			totalCount: 0,
			displayedCount: 0,
			currentPage: 0,
			currentOffset: 0,
			headers: [],
			totalPages: 0,
		},
		...updatedTimeRange,
		alerts
	};
};

const applyCustomQuery = (store: LogsStore, query: string, mode: 'filters' | 'sql') => {
	const { custQuerySearchState } = store;
	return {
		custQuerySearchState: {
			...custQuerySearchState,
			showQueryBuilder: false,
			isQuerySearchActive: true,
			custSearchQuery: query,
			activeMode: mode,
		},
		...getCleanStoreForRefetch(store),
	};
};

const setAndSortData = (store: LogsStore, sortKey: string, sortOrder: 'asc' | 'desc') => {
	const { data, tableOpts } = store;
	const filteredData = filterAndSortData({ sortKey, sortOrder, filters: tableOpts.filters }, data.rawData);
	const currentPage = 1;
	const newPageSlice = getPageSlice(currentPage, tableOpts.perPage, filteredData);

	return {
		data: {
			...data,
			filteredData,
		},
		tableOpts: {
			...tableOpts,
			sortKey,
			sortOrder,
			pageData: newPageSlice,
			currentPage,
			totalPages: getTotalPages(filteredData, tableOpts.perPage),
		},
	};
};

const setAndFilterData = (store: LogsStore, filterKey: string, filterValues: string[], remove: boolean = false) => {
	const { data, tableOpts } = store;
	const { sortKey, sortOrder, filters } = tableOpts;
	const updatedFilters = remove ? _.omit(filters, filterKey) : { ...filters, [filterKey]: filterValues };
	const filteredData = filterAndSortData({ sortOrder, sortKey, filters: updatedFilters }, data.rawData);
	const currentPage = 1;
	const newPageSlice = getPageSlice(currentPage, tableOpts.perPage, filteredData);

	return {
		data: {
			...data,
			filteredData,
		},
		tableOpts: {
			...tableOpts,
			filters: updatedFilters,
			pageData: newPageSlice,
			currentPage,
			totalPages: getTotalPages(filteredData, tableOpts.perPage),
		},
	};
};

const getUniqueValues = (data: Log[], key: string) => {
	return _.chain(data)
		.map(key)
		.compact()
		.uniq()
		.map((v) => _.toString(v))
		.value();
};

const makeExportData = (data: Log[], headers: string[], type: string): Log[] => {
	if (type === 'JSON') {
		return data;
	} else if (type === 'CSV') {
		const sanitizedCSVData = sanitizeCSVData(data, headers);
		return [headers, ...sanitizedCSVData];
	} else {
		return [];
	}
};

const setRetention = (_store: LogsStore, retention: { duration?: string; description?: string }) => {
	const durationInNumber = _.isString(retention.duration)
		? _.chain(retention.duration).split('d').head().toInteger().value()
		: 0;
	return {
		retention: {
			duration: durationInNumber,
			description: retention.description || '',
			action: 'delete' as 'delete',
		},
	};
};

const operatorLabelMap = {
	lessThanEquals: '<=',
	greaterThanEquals: '>=',
	lessThan: '<',
	greaterThan: '>',
	equalTo: '=',
	notEqualTo: '!=',
	exact: '=',
	notExact: '!=',
	contains: '=%',
	notContains: '!%',
	regex: '~',
};

// transforms alerts data for forms
const santizeAlerts = (alerts: Alert[]): TransformedAlert[] => {
	// @ts-ignore
	return _.reduce(
		alerts,
		// @ts-ignore
		(acc: Alert[], alert: Alert) => {
			const { targets = [], rule } = alert;
			const updatedRule = (() => {
				const { type, config } = rule;
				if (type === 'column') {
					const updatedOperator = _.get(operatorLabelMap, config.operator, config.operator);
					return {
						type,
						config: {
							...config,
							operator: updatedOperator,
						},
					};
				} else {
					return rule;
				}
			})();
			const updatedTargets = _.map(targets, (target) => {
				if (target.type === 'webhook') {
					const { headers = {} } = target;
					const headersAsArray = _.map(headers, (v, k) => ({ header: k, value: v }));
					return { ...target, headers: headersAsArray };
				} else {
					return target;
				}
			});

			return [...acc, { ...alert, targets: updatedTargets, rule: updatedRule }];
		},
		[] as TransformedAlert[],
	);
};

const transformAlerts = (alerts: TransformedAlert[]): Alert[] => {
	return _.reduce(
		alerts,
		// @ts-ignore
		(acc: Alert[], alert) => {
			const { targets = [] } = alert;
			const updatedTargets = _.map(targets, (target) => {
				if (target.type === 'webhook') {
					const { headers = {}, endpoint, skip_tls_check, repeat, type } = target;
					const transformedHeaders: { [key: string]: string } = {};
					if (_.isArray(headers)) {
						_.map(headers, (h: { header: string; value: string }) => {
							transformedHeaders[h.header] = h.value;
						});
					}
					return { type, endpoint, skip_tls_check, repeat, headers: transformedHeaders };
				} else if (target.type === 'slack') {
					const { repeat, endpoint, type } = target;
					return { repeat, endpoint, type };
				} else if (target.type === 'alertmanager') {
					const { endpoint, skip_tls_check, repeat, type, username, password } = target;
					return { type, endpoint, skip_tls_check, repeat, username, password };
				} else {
					return target;
				}
			});
			return [...acc, { ...alert, targets: updatedTargets }];
		},
		[] as Alert[],
	);
};

const setAlerts = (_store: LogsStore, alertsResponse: AlertsResponse) => {
	const { alerts } = alertsResponse;
	const sanitizedAlerts: TransformedAlert[] = santizeAlerts(alerts);
	return {
		alerts: { ...alertsResponse, alerts: sanitizedAlerts },
	};
};

const logsStoreReducers: LogsStoreReducers = {
	setTimeRange,
	// resetTimeRange,
	deleteFilterItem,
	addFilterItem,
	setLiveTailStatus,
	resetLiveTailSearchState,
	setLiveTailSchema,
	setRefreshInterval,
	resetQuickFilters,
	streamChangeCleanup,
	toggleQueryBuilder,
	resetCustQuerySearchState,
	setCustQuerySearchState,
	toggleCustQuerySearchViewMode,
	toggleAlertsModal,
	toggleRetentionModal,
	toggleDeleteModal,
	toggleDisabledColumns,
	togglePinnedColumns,
	setData,
	setStreamSchema,
	setPerPage,
	setCurrentPage,
	setCurrentOffset,
	setTotalCount,
	setPageAndPageData,
	applyCustomQuery,
	setAndSortData,
	getUniqueValues,
	setAndFilterData,
	getCleanStoreForRefetch,
	toggleLiveTail,
	setSelectedLog,
	makeExportData,
	setRetention,
	setAlerts,
	transformAlerts,
	setCleanStoreForStreamChange,
};

export { LogsProvider, useLogsStore, logsStoreReducers };
