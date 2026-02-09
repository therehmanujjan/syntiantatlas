import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const withAuth = (WrappedComponent, allowedRoles = []) => {
    return (props) => {
        const router = useRouter();
        const [isAuthorized, setIsAuthorized] = useState(false);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            const checkAuth = () => {
                const token = localStorage.getItem('token');
                const userStr = localStorage.getItem('user');

                if (!token || !userStr) {
                    router.replace('/login');
                    return;
                }

                try {
                    const user = JSON.parse(userStr);

                    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
                        router.replace('/unauthorized'); // Or dashboard/home
                        return;
                    }

                    setIsAuthorized(true);
                } catch (error) {
                    console.error("Auth error:", error);
                    localStorage.clear();
                    router.replace('/login');
                } finally {
                    setIsLoading(false);
                }
            };

            checkAuth();
        }, [router]);

        if (isLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            );
        }

        if (!isAuthorized) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };
};

export default withAuth;
