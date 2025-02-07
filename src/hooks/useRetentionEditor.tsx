import { useMutation, useQuery } from 'react-query';
import { getLogStreamRetention, putLogStreamRetention } from '@/api/logStream';
import { notifyError, notifySuccess } from '@/utils/notification';
import { AxiosError, isAxiosError } from 'axios';

export const useRetentionEditor = (streamName: string) => {
	const { mutate: updateLogStreamRetention } = useMutation(
		(data: { config: any; onSuccess?: () => void }) => putLogStreamRetention(streamName, data.config),
		{
			onSuccess: (_data, variables) => {
				notifySuccess({ message: 'Updated Successfully' });
				variables.onSuccess && variables.onSuccess();
			},
			onError: (data: AxiosError) => {
				if (isAxiosError(data) && data.response) {
					const error = data.response?.data as string;
					typeof error === 'string' && notifyError({ message: error });
				} else if (data.message && typeof data.message === 'string') {
					notifyError({ message: data.message });
				}
			},
		},
	);

	return {
		updateLogStreamRetention,
	};
};

export const useGetRetention = (streamName: string) => {
	const {
		data: getLogRetentionData,
		isError: getLogRetentionIsError,
		isLoading: getLogRetentionIsLoading,
		isSuccess: getLogRetentionIsSuccess,
		refetch: getLogRetentionDataRefetch
	} = useQuery(['fetch-log-stream-retention', streamName], () => getLogStreamRetention(streamName), {
		onSuccess: () => {},
		retry: false,
		enabled: streamName !== '',
		refetchOnWindowFocus: false,
	});
	return {
		getLogRetentionData,
		getLogRetentionIsLoading,
		getLogRetentionIsError,
		getLogRetentionIsSuccess,
		getLogRetentionDataRefetch
	};
};
