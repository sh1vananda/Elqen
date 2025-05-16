// elqen-frontend/src/components/CreateCircle.tsx
import React from 'react';
import { ethers } from 'ethers';

// Props interface defines what App.tsx will pass
interface CreateCirclePlaceholderProps {
    currentAccount: string | null;
    setUserMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>>;
    provider: ethers.BrowserProvider | null; // Prop name from App.tsx
    signer: ethers.Signer | null;           // Prop name from App.tsx
    onCircleCreated: (newCircleAddress: string) => void; // Prop name from App.tsx
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>; // Prop name from App.tsx
}

const CreateCirclePlaceholder: React.FC<CreateCirclePlaceholderProps> = ({
    currentAccount,    // Used
    setUserMessage,    // Used
    // These props are received, but this placeholder's logic doesn't use them.
    // So, we prefix the DESTRUCTURED VARIABLE with an underscore for ESLint.
    provider: _provider,                 // Destructured as _provider
    signer: _signer,                     // Destructured as _signer
    onCircleCreated: _onCircleCreated,   // Destructured as _onCircleCreated
    setIsLoading: _setIsLoading,         // Destructured as _setIsLoading
}) => {
    const handleComingSoon = () => {
        setUserMessage({type: 'success', text: 'Circle creation from UI is coming soon! Using pre-deployed circle for now.'});
    };

    // To "use" the underscored variables if ESLint is still complaining about them being defined but not read
    // (even though the underscore is the convention for "intentionally unused"):
    // useEffect(() => {
    //  if (_provider || _signer || _onCircleCreated || _setIsLoading) {
    //      // This block does nothing, just references the variables
    //  }
    // }, [_provider, _signer, _onCircleCreated, _setIsLoading]);
    // However, usually, just prefixing the destructured variable is enough for most ESLint configs.

    return (
        <div className="section">
            <h2>Create New Circle</h2>
            <p>
                (This feature is planned. For now, please use the pre-configured circle.)
            </p>
            <button onClick={handleComingSoon} disabled={!currentAccount}>
                Create New Circle (Coming Soon)
            </button>
        </div>
    );
};

export default CreateCirclePlaceholder;