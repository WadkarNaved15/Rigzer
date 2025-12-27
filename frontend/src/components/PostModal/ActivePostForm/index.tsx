// postModal/ActivePostForm/index.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import MediaPostForm from "./MediaPostForm";
import TextPostForm from "./TextPostForm";
import ModelPostForm from "./ModelPostForm";
import { PostType } from "../../../types/postTypes";

const postFormRegistry: Record<
  PostType,
  React.FC<{ onCancel: () => void }>
> = {
  model: ModelPostForm,
  media: MediaPostForm,
  game: TextPostForm,
  devlog: () => null // Registry needs a component, even if empty
};

const ActivePostForm = ({
  postType,
  onCancel,
}: {
  postType: PostType;
  onCancel: () => void;
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (postType === 'devlog') {
      // Internal navigation using React Router
      navigate('/devlogCanvas');
    }
  }, [postType, navigate, onCancel]);

  // If devlog, render nothing while the redirect happens
  if (postType === 'devlog') return null;

  const FormComponent = postFormRegistry[postType];
  return <FormComponent onCancel={onCancel} />;
};

export default ActivePostForm;